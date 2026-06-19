import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { allocateSequentialCodes, generateMaThuChi, getThuChiPrefix, withUniqueCodeRetry } from '@/lib/generateId';
import { ghiNhatKy } from '@/lib/audit';
import { notifyManagers } from '@/lib/webpush';

const DEFAULT_LIMIT = 50;

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Bạn không có quyền truy cập dữ liệu Thu-Chi.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const loaiGiaoDich = searchParams.get('loaiGiaoDich');
    const quyId = searchParams.get('quyId');
    const danhMucId = searchParams.get('danhMucId');
    const nhomChiPhiId = searchParams.get('nhomChiPhiId');
    const nam = searchParams.get('nam');
    const thang = searchParams.get('thang');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)));
    const skip = (page - 1) * limit;
    const includeHistory = searchParams.get('includeHistory') === 'true';

    const allowedSortFields = ['maPhieu', 'ngayGiaoDich', 'soTien', 'ngayTao'];
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

    const include = {
      quy: true,
      danhMuc: { include: { nhomChiPhi: true } },
      nhaCungCap: true,
      nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
      deXuatChiPhi: {
        select: {
          id: true,
          maPhieu: true,
          noiDung: true,
          soTien: true,
          trangThai: true,
          nguoiTao: { select: { hoTen: true, tenNgan: true } },
        },
      },
    };

    // Xây dựng where cho ThuChi
    const where = {};
    if (loaiGiaoDich) {
      where.loaiGiaoDich = { in: loaiGiaoDich.split(',').map(s => s.trim()).filter(Boolean) };
    }
    if (quyId) {
      where.quyId = { in: quyId.split(',').map(s => s.trim()).filter(Boolean) };
    }
    if (danhMucId) {
      where.danhMucId = { in: danhMucId.split(',').map(s => s.trim()).filter(Boolean) };
    }
    if (nhomChiPhiId) {
      where.danhMuc = {
        nhomChiPhiId: { in: nhomChiPhiId.split(',').map(s => s.trim()).filter(Boolean) }
      };
    }

    const year = parseInt(nam, 10);
    if (!isNaN(year)) {
      if (thang) {
        const months = thang.split(',').map(m => parseInt(m.trim(), 10)).filter(m => !isNaN(m) && m >= 1 && m <= 12);
        if (months.length > 0) {
          where.OR = months.map(m => {
            const startDate = new Date(Date.UTC(year, m - 1, 1));
            const endDate = new Date(Date.UTC(year, m, 1));
            return {
              ngayGiaoDich: {
                gte: startDate,
                lt: endDate
              }
            };
          });
        } else {
          where.ngayGiaoDich = {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1))
          };
        }
      } else {
        where.ngayGiaoDich = {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1))
        };
      }
    }

    // Tìm kiếm theo mã phiếu / nội dung
    if (search && search.trim()) {
      const s = search.trim();
      const searchOR = [
        { maPhieu: { contains: s, mode: 'insensitive' } },
        { noiDung: { contains: s, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    // Khi includeHistory=true: gộp thêm phiếu lịch sử từ DeXuatChiPhi vào kết quả
    if (includeHistory) {
      let isHistoryApplicable = true;
      if (loaiGiaoDich && !loaiGiaoDich.split(',').map(s => s.trim()).includes('CHI')) {
        isHistoryApplicable = false;
      }
      if (quyId) {
        isHistoryApplicable = false;
      }

      let historyRecords = [];
      if (isHistoryApplicable) {
        const historyWhere = { laLichSu: true, thuChiId: null };
        if (danhMucId) {
          historyWhere.danhMucId = { in: danhMucId.split(',').map(s => s.trim()).filter(Boolean) };
        }
        if (nhomChiPhiId) {
          historyWhere.danhMuc = {
            nhomChiPhiId: { in: nhomChiPhiId.split(',').map(s => s.trim()).filter(Boolean) }
          };
        }
        // Dùng ngayPhatSinh để khớp với /api/loi-nhuan và /api/ke-hoach
        if (!isNaN(year)) {
          if (thang) {
            const months = thang.split(',').map(m => parseInt(m.trim(), 10)).filter(m => !isNaN(m) && m >= 1 && m <= 12);
            if (months.length > 0) {
              historyWhere.OR = months.map(m => {
                const startDate = new Date(Date.UTC(year, m - 1, 1));
                const endDate = new Date(Date.UTC(year, m, 1));
                return { ngayPhatSinh: { gte: startDate, lt: endDate } };
              });
            } else {
              historyWhere.ngayPhatSinh = {
                gte: new Date(Date.UTC(year, 0, 1)),
                lt: new Date(Date.UTC(year + 1, 0, 1)),
              };
            }
          } else {
            historyWhere.ngayPhatSinh = {
              gte: new Date(Date.UTC(year, 0, 1)),
              lt: new Date(Date.UTC(year + 1, 0, 1)),
            };
          }
        }

        historyRecords = await prisma.deXuatChiPhi.findMany({
          where: historyWhere,
          include: {
            danhMuc: { include: { nhomChiPhi: true } },
            nhaCungCap: true,
            nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
          },
          orderBy: { ngayPhatSinh: 'desc' },
        });
      }

      const allThuChis = await prisma.thuChi.findMany({
        where,
        include,
        orderBy,
      });

      const normalizedThuChis = allThuChis.map((tc) => ({
        ...tc,
        soPhieuDeXuat: tc.deXuatChiPhi.length,
        tongTienDeXuat: tc.deXuatChiPhi.reduce((sum, dx) => sum + dx.soTien, 0),
        laLichSu: false,
      }));

      const normalizedLichSu = historyRecords.map((dx) => ({
        id: dx.id,
        maPhieu: dx.maPhieu,
        ngayGiaoDich: dx.ngayPhatSinh,
        loaiGiaoDich: 'CHI',
        soTien: dx.soTien,
        danhMucId: dx.danhMucId,
        danhMuc: dx.danhMuc,
        nhaCungCapId: dx.nhaCungCapId,
        nhaCungCap: dx.nhaCungCap,
        noiDung: dx.noiDung,
        ghiChu: dx.ghiChu,
        quyId: null,
        quy: null,
        nguoiTaoId: dx.nguoiTaoId,
        nguoiTao: dx.nguoiTao,
        deXuatChiPhi: [],
        soPhieuDeXuat: 0,
        tongTienDeXuat: dx.soTien,
        laLichSu: true,
        ngayTao: dx.ngayTao,
      }));

      const allData = [...normalizedThuChis, ...normalizedLichSu];
      if (orderField === 'soTien') {
        allData.sort((a, b) => sortOrder === 'asc' ? a.soTien - b.soTien : b.soTien - a.soTien);
      } else if (orderField === 'maPhieu') {
        allData.sort((a, b) => {
          return sortOrder === 'asc' 
            ? a.maPhieu.localeCompare(b.maPhieu) 
            : b.maPhieu.localeCompare(a.maPhieu);
        });
      } else if (orderField === 'ngayTao') {
        allData.sort((a, b) => {
          const dateA = new Date(a.ngayTao || a.ngayGiaoDich);
          const dateB = new Date(b.ngayTao || b.ngayGiaoDich);
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      } else {
        // default / ngayGiaoDich
        allData.sort((a, b) => {
          const dateA = new Date(a.ngayGiaoDich);
          const dateB = new Date(b.ngayGiaoDich);
          if (dateA.getTime() === dateB.getTime()) {
            return sortOrder === 'asc'
              ? a.maPhieu.localeCompare(b.maPhieu)
              : b.maPhieu.localeCompare(a.maPhieu);
          }
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      }

      const total = allData.length;

      // Tính toán các chỉ số thống kê trên toàn bộ tập kết quả đã lọc
      let tongThu = allData
        .filter(t => t.loaiGiaoDich === 'THU')
        .reduce((sum, t) => sum + t.soTien, 0);

      const tongChi = allData
        .filter(t => t.loaiGiaoDich === 'CHI')
        .reduce((sum, t) => sum + t.soTien, 0);

      // Fallback: tháng chưa hợp thức hoá ThuChi.THU → dùng KeHoachDoanhThu.thucTe làm ước tính
      let tongThuUocTinh = false;
      if (tongThu === 0 && !isNaN(year)) {
        const selectedMonths = thang
          ? thang.split(',').map(m => parseInt(m.trim(), 10)).filter(m => !isNaN(m) && m >= 1 && m <= 12)
          : Array.from({ length: 12 }, (_, i) => i + 1);
        const doanhThuRows = await prisma.keHoachDoanhThu.groupBy({
          by: ['nam', 'thang'],
          where: { nam: year, thang: { in: selectedMonths } },
          _sum: { thucTe: true },
        });
        const tongDoanhThu = doanhThuRows.reduce((sum, r) => sum + Number(r._sum.thucTe || 0), 0);
        if (tongDoanhThu > 0) {
          tongThu = tongDoanhThu;
          tongThuUocTinh = true;
        }
      }

      const netCashflow = tongThu - tongChi;
      const tileChiThu = tongThu > 0 ? Math.round((tongChi / tongThu) * 100) : 0;

      const chiGroupStats = {};
      const thuGroupStats = {};
      const chiCatStats = {};
      const thuCatStats = {};

      allData.forEach((tx) => {
        const gId = tx.danhMuc?.nhomChiPhiId;
        const gName = tx.danhMuc?.nhomChiPhi?.tenNhom || 'Khác';
        const catId = tx.danhMucId;
        const catName = tx.danhMuc?.tenDanhMuc || 'Khác';

        if (tx.loaiGiaoDich === 'CHI') {
          if (gId) {
            if (!chiGroupStats[gId]) chiGroupStats[gId] = { id: gId, name: gName, amount: 0 };
            chiGroupStats[gId].amount += tx.soTien;
          }
          if (catId) {
            if (!chiCatStats[catId]) chiCatStats[catId] = { id: catId, name: catName, amount: 0 };
            chiCatStats[catId].amount += tx.soTien;
          }
        } else {
          if (gId) {
            if (!thuGroupStats[gId]) thuGroupStats[gId] = { id: gId, name: gName, amount: 0 };
            thuGroupStats[gId].amount += tx.soTien;
          }
          if (catId) {
            if (!thuCatStats[catId]) thuCatStats[catId] = { id: catId, name: catName, amount: 0 };
            thuCatStats[catId].amount += tx.soTien;
          }
        }
      });

      const sortedChiGroups = Object.values(chiGroupStats).sort((a, b) => b.amount - a.amount);
      const sortedThuGroups = Object.values(thuGroupStats).sort((a, b) => b.amount - a.amount);
      const sortedChiCats = Object.values(chiCatStats).sort((a, b) => b.amount - a.amount).slice(0, 5);
      const sortedThuCats = Object.values(thuCatStats).sort((a, b) => b.amount - a.amount).slice(0, 5);

      const paginatedData = allData.slice(skip, skip + limit);

      return NextResponse.json({
        data: paginatedData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          tongThu,
          tongThuUocTinh,
          tongChi,
          netCashflow,
          tileChiThu,
          sortedChiGroups,
          sortedThuGroups,
          sortedChiCats,
          sortedThuCats,
        }
      });
    }

    const [total, thuChis] = await Promise.all([
      prisma.thuChi.count({ where }),
      prisma.thuChi.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const data = thuChis.map((tc) => ({
      ...tc,
      soPhieuDeXuat: tc.deXuatChiPhi.length,
      tongTienDeXuat: tc.deXuatChiPhi.reduce((sum, dx) => sum + dx.soTien, 0),
      laLichSu: false,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    logger.error('GET /api/thu-chi', error);
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

    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) hoặc Quản lý (Manager) mới có quyền tạo giao dịch Thu-Chi trực tiếp.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ngayGiaoDich, loaiGiaoDich, soTien, quyId, danhMucId, nhaCungCapId, noiDung, ghiChu, buTruLichSu } = body;

    if (!ngayGiaoDich || !loaiGiaoDich || !soTien || !quyId || !danhMucId || !noiDung) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' },
        { status: 400 }
      );
    }

    if (typeof noiDung !== 'string' || noiDung.trim().length === 0 || noiDung.length > 500) {
      return NextResponse.json(
        { error: 'Nội dung giao dịch không hợp lệ (1–500 ký tự).' },
        { status: 400 }
      );
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json(
        { error: 'Số tiền giao dịch phải lớn hơn 0.' },
        { status: 400 }
      );
    }

    if (!['CHI', 'THU'].includes(loaiGiaoDich)) {
      return NextResponse.json({ error: 'Loại giao dịch không hợp lệ.' }, { status: 400 });
    }

    // buTruLichSu chỉ cho phép với CHI (CHI + THU tự sinh = cặp bù trừ)
    if (buTruLichSu && loaiGiaoDich !== 'CHI') {
      return NextResponse.json({ error: 'Bù trừ lịch sử chỉ áp dụng cho giao dịch CHI.' }, { status: 400 });
    }

    const [quy, danhMuc] = await Promise.all([
      prisma.quy.findUnique({ where: { id: quyId } }),
      prisma.danhMuc.findUnique({ where: { id: danhMucId } }),
    ]);

    if (!quy) {
      return NextResponse.json({ error: 'Quỹ được chọn không hợp lệ.' }, { status: 400 });
    }
    if (!danhMuc) {
      return NextResponse.json({ error: 'Danh mục giao dịch không hợp lệ.' }, { status: 400 });
    }
    // Khi buTruLichSu=true, danhMucId là danh mục CHI — bỏ qua kiểm tra loại cho cặp THU bù trừ
    if (!buTruLichSu && danhMuc.loaiGiaoDich !== loaiGiaoDich) {
      return NextResponse.json(
        { error: `Danh mục "${danhMuc.tenDanhMuc}" là loại ${danhMuc.loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'}, không khớp với loại giao dịch đã chọn.` },
        { status: 400 }
      );
    }

    // ——— CHẾ ĐỘ BÙ TRỪ LỊCH SỬ: tạo cặp CHI + THU cùng lúc ———
    if (buTruLichSu) {
      const ngay = new Date(ngayGiaoDich);
      const soTienRound = lamTronTien(soTien);
      const { chiRecord, thuRecord } = await withUniqueCodeRetry(async () => {
        const [maPhieuChi, maPhieuThu] = await allocateSequentialCodes({
          model: 'thuChi',
          field: 'maPhieu',
          prefix: getThuChiPrefix(),
          count: 2,
        });

        return prisma.$transaction(async (tx) => {
          const chiRecord = await tx.thuChi.create({
            data: {
              maPhieu: maPhieuChi,
              ngayGiaoDich: ngay,
              loaiGiaoDich: 'CHI',
              soTien: soTienRound,
              quyId,
              danhMucId,
              nhaCungCapId: nhaCungCapId || null,
              noiDung: noiDung.trim(),
              nguoiTaoId: user.id,
              ghiChu: ghiChu || '',
              buTruLichSu: true,
            },
          });
          const thuRecord = await tx.thuChi.create({
            data: {
              maPhieu: maPhieuThu,
              ngayGiaoDich: ngay,
              loaiGiaoDich: 'THU',
              soTien: soTienRound,
              quyId,
              danhMucId,
              nhaCungCapId: null,
              noiDung: `[BT] ${noiDung.trim()}`,
              nguoiTaoId: user.id,
              ghiChu: 'Bu tru lich su - tu sinh tu dong',
              buTruLichSu: true,
            },
          });
          return { chiRecord, thuRecord };
        });
      });
      await ghiNhatKy({
        user,
        hanhDong: 'TAO',
        doiTuong: 'THU_CHI',
        maDoiTuong: chiRecord.id,
        moTa: `Nhap lich su quy bu tru: ${noiDung.trim()} - ${soTienRound.toLocaleString('vi-VN')}d (${chiRecord.maPhieu} + ${thuRecord.maPhieu})`,
      });
      return NextResponse.json({
        success: true,
        buTruLichSu: true,
        chiId: chiRecord.id,
        thuId: thuRecord.id,
        maPhieuChi: chiRecord.maPhieu,
        maPhieuThu: thuRecord.maPhieu,
        message: `Da nhap lich su quy: ${chiRecord.maPhieu} (CHI) + ${thuRecord.maPhieu} (THU bu tru). So du quy khong doi.`,
      });
    }
    // ——— LUỒNG BÌNH THƯỜNG ———
    const newThuChi = await withUniqueCodeRetry(async () => {
      const maPhieu = await generateMaThuChi();
      return prisma.thuChi.create({
        data: {
          maPhieu,
          ngayGiaoDich: new Date(ngayGiaoDich),
          loaiGiaoDich,
          soTien: lamTronTien(soTien),
          quyId,
          danhMucId,
          nhaCungCapId: nhaCungCapId || null,
          noiDung: noiDung.trim(),
          nguoiTaoId: user.id,
          ghiChu: ghiChu || '',
        },
      });
    });

    await ghiNhatKy({
      user,
      hanhDong: 'TAO',
      doiTuong: 'THU_CHI',
      maDoiTuong: newThuChi.maPhieu,
      moTa: `Tạo phiếu ${loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'} "${newThuChi.noiDung}" — ${Number(newThuChi.soTien).toLocaleString('vi-VN')}đ (quỹ ${quy.tenQuy})`,
    });

    // Thông báo Web Push khi ghi nhận phiếu THU → các OWNER/MANAGER khác (trừ người vừa tạo).
    // Bọc try/catch riêng: lỗi push KHÔNG được làm hỏng luồng tạo phiếu.
    if (loaiGiaoDich === 'THU') {
      try {
        await notifyManagers(
          {
            title: '💰 Có phiếu Thu mới',
            body: `${newThuChi.maPhieu} · ${Number(newThuChi.soTien).toLocaleString('vi-VN')}đ — ${newThuChi.noiDung}`,
            url: '/thu-chi',
            tag: 'thu-chi-thu',
          },
          { excludeUserId: user.id }
        );
      } catch (pushErr) {
        logger.error('notifyManagers (phiếu Thu)', pushErr);
      }
    }

    return NextResponse.json({
      success: true,
      thuChi: newThuChi,
      message: `Đã ghi nhận phiếu ${loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'} ${newThuChi.maPhieu} thành công.`,
    });
  } catch (error) {
    logger.error('POST /api/thu-chi', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
