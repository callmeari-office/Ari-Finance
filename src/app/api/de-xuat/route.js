import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaDeXuat } from '@/lib/generateId';
import { notifyManagersChoThanhToan } from '@/lib/email';
import { notifyManagers as pushNotifyManagers } from '@/lib/webpush';
import { canViewCategory, isRestrictedToOwnProposals } from '@/lib/roles';
import { ghiNhatKy } from '@/lib/audit';

const DEFAULT_LIMIT = 20;

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trangThai = searchParams.get('trangThai');
    const nguonTien = searchParams.get('nguonTien');
    const nhaCungCapId = searchParams.get('nhaCungCapId');
    const danhMucId = searchParams.get('danhMucId');
    const nguoiTaoId = searchParams.get('nguoiTaoId');
    const nam = searchParams.get('nam');
    const thang = searchParams.get('thang');
    const search = searchParams.get('search');

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)));
    const skip = (page - 1) * limit;

    const where = {};
    if (trangThai) {
      where.trangThai = { in: trangThai.split(',').map(s => s.trim()).filter(Boolean) };
    }
    if (nguonTien) {
      where.nguonTien = { in: nguonTien.split(',').map(s => s.trim()).filter(Boolean) };
    }
    if (nhaCungCapId) {
      where.nhaCungCapId = nhaCungCapId;
    }
    if (danhMucId) {
      where.danhMucId = { in: danhMucId.split(',').map(s => s.trim()).filter(Boolean) };
    }

    // Staff (và Leader) chỉ thấy đề xuất của mình
    if (isRestrictedToOwnProposals(user.role)) {
      where.nguoiTaoId = user.id;
    } else if (nguoiTaoId) {
      where.nguoiTaoId = { in: nguoiTaoId.split(',').map(s => s.trim()).filter(Boolean) };
    }

    // Lọc theo năm và tháng của ngayPhatSinh
    const year = parseInt(nam, 10);
    if (!isNaN(year)) {
      if (thang) {
        const months = thang.split(',').map(m => parseInt(m.trim(), 10)).filter(m => !isNaN(m) && m >= 1 && m <= 12);
        if (months.length > 0) {
          where.OR = months.map(m => {
            const startDate = new Date(Date.UTC(year, m - 1, 1));
            const endDate = new Date(Date.UTC(year, m, 1));
            return {
              ngayPhatSinh: {
                gte: startDate,
                lt: endDate
              }
            };
          });
        } else {
          where.ngayPhatSinh = {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1))
          };
        }
      } else {
        where.ngayPhatSinh = {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1))
        };
      }
    }

    // Tìm kiếm (mã phiếu, nội dung, tên NCC)
    if (search) {
      const q = search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { maPhieu: { contains: q, mode: 'insensitive' } },
            { noiDung: { contains: q, mode: 'insensitive' } },
            {
              nhaCungCap: {
                tenNCC: { contains: q, mode: 'insensitive' }
              }
            }
          ]
        }
      ];
    }

    const include = {
      danhMuc: { include: { nhomChiPhi: true } },
      nhaCungCap: true,
      quyThanhToan: true,
      nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true, role: true } },
      nguoiDuyet: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
    };

    const [total, proposals, totalSumResult] = await Promise.all([
      prisma.deXuatChiPhi.count({ where }),
      prisma.deXuatChiPhi.findMany({
        where,
        include,
        orderBy: { ngayTao: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deXuatChiPhi.aggregate({
        where,
        _sum: {
          soTien: true
        }
      })
    ]);

    const filteredProposals = proposals.filter((prop) => {
      if (user.role === 'OWNER' || user.role === 'MANAGER') return true;
      try {
        const allowedRoles = JSON.parse(prop.danhMuc.chucVuDuocXem);
        return canViewCategory(user.role, allowedRoles);
      } catch {
        return false;
      }
    });

    const totalSum = totalSumResult._sum.soTien || 0;

    return NextResponse.json({
      data: filteredProposals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        totalSum
      },
    });
  } catch (error) {
    logger.error('GET /api/de-xuat', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      ngayPhatSinh,
      danhMucId,
      noiDung,
      soTien,
      nhaCungCapId,
      nguonTien,
      trangThai,
      ghiChu,
      ngayCanThanhToan,
      anhHoaDon,
    } = body;

    // Kiểm tra ảnh hóa đơn nếu có gửi lên
    if (anhHoaDon) {
      const MAX_BYTES = 2 * 1024 * 1024; // 2 MB sau khi decode
      if (typeof anhHoaDon !== 'string' || !anhHoaDon.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Ảnh hóa đơn không hợp lệ (chỉ chấp nhận file ảnh).' }, { status: 400 });
      }
      const commaIdx = anhHoaDon.indexOf(',');
      if (commaIdx === -1) {
        return NextResponse.json({ error: 'Định dạng ảnh hóa đơn không hợp lệ.' }, { status: 400 });
      }
      const base64Data = anhHoaDon.slice(commaIdx + 1);
      const byteLength = Math.floor(base64Data.length * 0.75);
      if (byteLength > MAX_BYTES) {
        return NextResponse.json({ error: 'Ảnh hóa đơn quá lớn (tối đa 2 MB). Vui lòng nén ảnh trước khi tải lên.' }, { status: 400 });
      }
    }

    if (!ngayPhatSinh || !danhMucId || !noiDung || !soTien || !nguonTien || !trangThai) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' },
        { status: 400 }
      );
    }

    if (typeof noiDung !== 'string' || noiDung.trim().length === 0 || noiDung.length > 500) {
      return NextResponse.json(
        { error: 'Nội dung đề xuất không hợp lệ (1–500 ký tự).' },
        { status: 400 }
      );
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json(
        { error: 'Số tiền đề xuất phải lớn hơn 0.' },
        { status: 400 }
      );
    }

    const VALID_NGUON_TIEN = ['TIEN_SHOP', 'TIEN_CA_NHAN'];
    const VALID_TRANG_THAI = ['CHO_THANH_TOAN', 'CHO_HOAN_UNG', 'DA_THANH_TOAN'];
    if (!VALID_NGUON_TIEN.includes(nguonTien)) {
      return NextResponse.json({ error: 'Nguồn tiền không hợp lệ.' }, { status: 400 });
    }
    if (!VALID_TRANG_THAI.includes(trangThai)) {
      return NextResponse.json({ error: 'Trạng thái đề xuất không hợp lệ.' }, { status: 400 });
    }

    const danhMuc = await prisma.danhMuc.findUnique({ where: { id: danhMucId } });
    if (!danhMuc) {
      return NextResponse.json({ error: 'Danh mục chi phí không hợp lệ.' }, { status: 400 });
    }

    try {
      const allowedRoles = JSON.parse(danhMuc.chucVuDuocXem);
      if (!canViewCategory(user.role, allowedRoles)) {
        return NextResponse.json(
          { error: 'Bạn không có quyền chọn danh mục chi phí này.' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'Lỗi kiểm tra quyền danh mục.' }, { status: 500 });
    }

    if (danhMuc.yeuCauNCC && !nhaCungCapId) {
      return NextResponse.json(
        { error: `Danh mục "${danhMuc.tenDanhMuc}" yêu cầu phải chọn Nhà cung cấp.` },
        { status: 400 }
      );
    }

    const maPhieu = await generateMaDeXuat();

    const newProposal = await prisma.deXuatChiPhi.create({
      data: {
        maPhieu,
        ngayPhatSinh: new Date(ngayPhatSinh),
        danhMucId,
        noiDung: noiDung.trim(),
        soTien: Number(soTien),
        nhaCungCapId: nhaCungCapId || null,
        anhHoaDon: anhHoaDon || null,
        nguonTien,
        trangThai,
        ghiChu: ghiChu || null,
        nguoiTaoId: user.id,
        ngayCanThanhToan:
          ngayCanThanhToan && String(ngayCanThanhToan).trim() !== ''
            ? new Date(ngayCanThanhToan)
            : null,
      },
    });

    await ghiNhatKy({
      user,
      hanhDong: 'TAO',
      doiTuong: 'DE_XUAT',
      maDoiTuong: newProposal.maPhieu,
      moTa: `Tạo đề xuất "${newProposal.noiDung}" — ${Number(newProposal.soTien).toLocaleString('vi-VN')}đ`,
    });

    // Gửi email thông báo cho OWNER + MANAGER khi phiếu ở trạng thái "Chờ thanh toán".
    // Await để chắc chắn email được gửi trên môi trường serverless, nhưng hàm này
    // tự bắt lỗi bên trong nên KHÔNG làm hỏng luồng tạo phiếu nếu gửi mail thất bại.
    if (newProposal.trangThai === 'CHO_THANH_TOAN') {
      await notifyManagersChoThanhToan(newProposal.id);
      // Gửi push notification song song với email (tự bắt lỗi bên trong)
      pushNotifyManagers({
        title: 'Phiếu mới chờ duyệt',
        body: `${newProposal.noiDung} — ${Number(newProposal.soTien).toLocaleString('vi-VN')}đ`,
        url: '/de-xuat/duyet',
        tag: 'phieu-cho-duyet',
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      proposal: newProposal,
      message: `Đã tạo đề xuất ${maPhieu} thành công.`,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
