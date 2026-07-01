import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaDeXuat, withUniqueCodeRetry } from '@/lib/generateId';
import { notifyManagersChoThanhToan } from '@/lib/email';
import { notifyManagers as pushNotifyManagers } from '@/lib/webpush';
import { canViewCategory, isRestrictedToOwnProposals, getEffectiveRoles, canChonLamNguoiDeXuat } from '@/lib/roles';
import { ghiNhatKy } from '@/lib/audit';
import { validateStorageImageUrl } from '@/lib/validateImage';
import { VALID_NGUON_TIEN, resolveCreateProposalStatus } from '@/lib/proposalWorkflow';
import { buildProposalDateWhere, buildProposalStatusWhere } from './filters';

const DEFAULT_LIMIT = 20;

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trangThai = searchParams.get('trangThai');
    const onlyPending = searchParams.get('onlyPending');
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

    const allowedSortFields = ['maPhieu', 'ngayPhatSinh', 'soTien', 'ngayTao'];
    const sortBy = searchParams.get('sortBy') || 'maPhieu';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'maPhieu';
    const orderBy = [];
    if (orderField === 'maPhieu') {
      orderBy.push({ maPhieu: sortOrder });
    } else {
      orderBy.push({ [orderField]: sortOrder });
      orderBy.push({ maPhieu: 'desc' });
    }

    const where = {};
    if (onlyPending === 'true') {
      const states = trangThai ? trangThai.split(',').map(s => s.trim()).filter(Boolean) : ['CHO_THANH_TOAN', 'CHO_HOAN_UNG', 'DA_THANH_TOAN'];
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { trangThai: { in: states.filter(s => s !== 'DA_THANH_TOAN') } },
            states.includes('DA_THANH_TOAN') ? {
              trangThai: 'DA_THANH_TOAN',
              laLichSu: false,
              OR: [
                { quyThanhToanId: null },
                { thuChiId: null }
              ]
            } : null
          ].filter(Boolean)
        }
      ];
    } else if (trangThai) {
      const statusWhere = buildProposalStatusWhere(trangThai);
      if (statusWhere) {
        where.AND = [
          ...(where.AND || []),
          statusWhere,
        ];
      }
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

    // Lọc theo năm và tháng của ngayPhatSinh (hỗ trợ multi-select)
    const dateWhere = buildProposalDateWhere(nam, thang);
    if (dateWhere) {
      where.AND = [
        ...(where.AND || []),
        dateWhere,
      ];
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

    // [M5] Lọc quyền danh mục tại DB để count/sum/pagination nhất quán
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      const effectiveRoles = getEffectiveRoles(user.role);
      where.danhMuc = {
        OR: effectiveRoles.map(r => ({ chucVuDuocXem: { contains: `"${r}"` } })),
      };
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
        orderBy,
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

    const totalSum = totalSumResult._sum.soTien || 0;

    return NextResponse.json({
      data: proposals,
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
      nguoiDeXuatId,
    } = body;

    // Kiểm tra URL ảnh hóa đơn nếu có gửi lên
    if (anhHoaDon) {
      const imgError = validateStorageImageUrl(anhHoaDon);
      if (imgError) {
        return NextResponse.json({ error: imgError }, { status: 400 });
      }
    }

    if (!ngayPhatSinh || !danhMucId || !noiDung || !soTien || !nguonTien) {
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
    if (!VALID_NGUON_TIEN.includes(nguonTien)) {
      return NextResponse.json({ error: 'Nguồn tiền không hợp lệ.' }, { status: 400 });
    }
    const finalTrangThai = resolveCreateProposalStatus({
      role: user.role,
      nguonTien,
      requestedTrangThai: trangThai,
    });

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

    let finalNguoiDeXuatId = user.id;
    if (nguoiDeXuatId && nguoiDeXuatId !== user.id) {
      const target = await prisma.nhanVien.findUnique({ where: { id: nguoiDeXuatId } });
      if (!target || !canChonLamNguoiDeXuat(user, target)) {
        return NextResponse.json(
          { error: 'Bạn không có quyền tạo giúp phiếu đề xuất cho người này.' },
          { status: 403 }
        );
      }
      finalNguoiDeXuatId = target.id;
    }

    const newProposal = await withUniqueCodeRetry(async () => {
      const maPhieu = await generateMaDeXuat();
      return prisma.deXuatChiPhi.create({
        data: {
          maPhieu,
          ngayPhatSinh: new Date(ngayPhatSinh),
          danhMucId,
          noiDung: noiDung.trim(),
          soTien: lamTronTien(soTien),
          nhaCungCapId: nhaCungCapId || null,
          anhHoaDon: anhHoaDon || null,
          nguonTien,
          trangThai: finalTrangThai,
          ghiChu: ghiChu || null,
          nguoiTaoId: user.id,
          nguoiDeXuatId: finalNguoiDeXuatId,
          ngayCanThanhToan:
            ngayCanThanhToan && String(ngayCanThanhToan).trim() !== ''
              ? new Date(ngayCanThanhToan)
              : null,
        },
      });
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
        tag: 'new-proposals',
      }).catch(() => {});
    } else if (newProposal.trangThai === 'CHO_HOAN_UNG') {
      pushNotifyManagers({
        title: 'Phiếu hoàn ứng mới',
        body: `${newProposal.noiDung} — ${Number(newProposal.soTien).toLocaleString('vi-VN')}đ`,
        url: '/de-xuat/duyet',
        tag: 'new-proposals',
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      proposal: newProposal,
      message: `Đã tạo đề xuất ${newProposal.maPhieu} thành công.`,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
