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
      return NextResponse.json({ error: 'ChÆ°a Ä‘Äƒng nháº­p.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Báº¡n khĂ´ng cĂ³ quyá»n truy cáº­p dá»¯ liá»‡u Thu-Chi.' },
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
          nguoiTao: { select: { id: true, hoTen: true, tenNgan: true } },
        },
      },
    };

    // XĂ¢y dá»±ng where cho ThuChi
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

    // TĂ¬m kiáº¿m theo mĂ£ phiáº¿u / ná»™i dung
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

    // Khi includeHistory=true: gá»™p thĂªm phiáº¿u lá»‹ch sá»­ tá»« DeXuatChiPhi vĂ o káº¿t quáº£
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
        // DĂ¹ng ngayPhatSinh Ä‘á»ƒ khá»›p vá»›i /api/loi-nhuan vĂ  /api/ke-hoach
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

      // TĂ­nh toĂ¡n cĂ¡c chá»‰ sá»‘ thá»‘ng kĂª trĂªn toĂ n bá»™ táº­p káº¿t quáº£ Ä‘Ă£ lá»c
      let tongThu = allData
        .filter(t => t.loaiGiaoDich === 'THU')
        .reduce((sum, t) => sum + t.soTien, 0);

      const tongChi = allData
        .filter(t => t.loaiGiaoDich === 'CHI')
        .reduce((sum, t) => sum + t.soTien, 0);

      // Fallback: thĂ¡ng chÆ°a há»£p thá»©c hoĂ¡ ThuChi.THU â†’ dĂ¹ng KeHoachDoanhThu.thucTe lĂ m Æ°á»›c tĂ­nh
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
        const gName = tx.danhMuc?.nhomChiPhi?.tenNhom || 'KhĂ¡c';
        const catId = tx.danhMucId;
        const catName = tx.danhMuc?.tenDanhMuc || 'KhĂ¡c';

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

      // === Chi phí theo NGƯỜI ĐỀ XUẤT (đã duyệt & chi thật) ===
      // Phân bổ ĐÚNG tổng chi của báo cáo theo người: ThuChi có đề xuất → người đề xuất
      // (phân bổ theo tỷ lệ soTien khi duyệt-gộp nhiều người); còn lại → "Không xác định".
      const UNKNOWN_NGUOI = '__unknown__';
      const chiNguoiStats = {};
      const addChiNguoi = (id, name, amount) => {
        if (!chiNguoiStats[id]) chiNguoiStats[id] = { id, name, amount: 0, count: 0 };
        chiNguoiStats[id].amount += amount;
        chiNguoiStats[id].count += 1;
      };
      allData.forEach((tx) => {
        if (tx.loaiGiaoDich !== 'CHI') return;
        const dxs = (!tx.laLichSu && Array.isArray(tx.deXuatChiPhi)) ? tx.deXuatChiPhi : [];
        if (dxs.length === 0) {
          addChiNguoi(UNKNOWN_NGUOI, 'Không xác định', tx.soTien);
          return;
        }
        const sumDx = dxs.reduce((s, d) => s + d.soTien, 0) || 1;
        dxs.forEach((d) => {
          const pid = d.nguoiTao?.id || UNKNOWN_NGUOI;
          const pname = d.nguoiTao?.id
            ? (d.nguoiTao.tenNgan || d.nguoiTao.hoTen || 'Không tên')
            : 'Không xác định';
          addChiNguoi(pid, pname, tx.soTien * (d.soTien / sumDx));
        });
      });
      const sortedChiNguoi = Object.values(chiNguoiStats)
        .map((p) => ({ ...p, amount: Math.round(p.amount) }))
        .sort((a, b) => {
          if (a.id === UNKNOWN_NGUOI) return 1;
          if (b.id === UNKNOWN_NGUOI) return -1;
          return b.amount - a.amount;
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
          sortedChiNguoi,
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
      { error: 'ÄĂ£ xáº£y ra lá»—i trĂªn há»‡ thá»‘ng.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'ChÆ°a Ä‘Äƒng nháº­p.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Chá»‰ Chá»§ shop (Owner) hoáº·c Quáº£n lĂ½ (Manager) má»›i cĂ³ quyá»n táº¡o giao dá»‹ch Thu-Chi trá»±c tiáº¿p.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ngayGiaoDich, loaiGiaoDich, soTien, quyId, danhMucId, nhaCungCapId, noiDung, ghiChu, buTruLichSu } = body;

    if (!ngayGiaoDich || !loaiGiaoDich || !soTien || !quyId || !danhMucId || !noiDung) {
      return NextResponse.json(
        { error: 'Vui lĂ²ng cung cáº¥p Ä‘áº§y Ä‘á»§ thĂ´ng tin báº¯t buá»™c.' },
        { status: 400 }
      );
    }

    if (typeof noiDung !== 'string' || noiDung.trim().length === 0 || noiDung.length > 500) {
      return NextResponse.json(
        { error: 'Ná»™i dung giao dá»‹ch khĂ´ng há»£p lá»‡ (1â€“500 kĂ½ tá»±).' },
        { status: 400 }
      );
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json(
        { error: 'Sá»‘ tiá»n giao dá»‹ch pháº£i lá»›n hÆ¡n 0.' },
        { status: 400 }
      );
    }

    if (!['CHI', 'THU'].includes(loaiGiaoDich)) {
      return NextResponse.json({ error: 'Loáº¡i giao dá»‹ch khĂ´ng há»£p lá»‡.' }, { status: 400 });
    }

    // buTruLichSu chá»‰ cho phĂ©p vá»›i CHI (CHI + THU tá»± sinh = cáº·p bĂ¹ trá»«)
    if (buTruLichSu && loaiGiaoDich !== 'CHI') {
      return NextResponse.json({ error: 'BĂ¹ trá»« lá»‹ch sá»­ chá»‰ Ă¡p dá»¥ng cho giao dá»‹ch CHI.' }, { status: 400 });
    }

    const [quy, danhMuc] = await Promise.all([
      prisma.quy.findUnique({ where: { id: quyId } }),
      prisma.danhMuc.findUnique({ where: { id: danhMucId } }),
    ]);

    if (!quy) {
      return NextResponse.json({ error: 'Quá»¹ Ä‘Æ°á»£c chá»n khĂ´ng há»£p lá»‡.' }, { status: 400 });
    }
    if (!danhMuc) {
      return NextResponse.json({ error: 'Danh má»¥c giao dá»‹ch khĂ´ng há»£p lá»‡.' }, { status: 400 });
    }
    // Khi buTruLichSu=true, danhMucId lĂ  danh má»¥c CHI â€” bá» qua kiá»ƒm tra loáº¡i cho cáº·p THU bĂ¹ trá»«
    if (!buTruLichSu && danhMuc.loaiGiaoDich !== loaiGiaoDich) {
      return NextResponse.json(
        { error: `Danh má»¥c "${danhMuc.tenDanhMuc}" lĂ  loáº¡i ${danhMuc.loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'}, khĂ´ng khá»›p vá»›i loáº¡i giao dá»‹ch Ä‘Ă£ chá»n.` },
        { status: 400 }
      );
    }

    // â€”â€”â€” CHáº¾ Äá»˜ BĂ™ TRá»ª Lá»CH Sá»¬: táº¡o cáº·p CHI + THU cĂ¹ng lĂºc â€”â€”â€”
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
    // â€”â€”â€” LUá»’NG BĂŒNH THÆ¯á»œNG â€”â€”â€”
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
      moTa: `Táº¡o phiáº¿u ${loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'} "${newThuChi.noiDung}" â€” ${Number(newThuChi.soTien).toLocaleString('vi-VN')}Ä‘ (quá»¹ ${quy.tenQuy})`,
    });

    // ThĂ´ng bĂ¡o Web Push khi ghi nháº­n phiáº¿u THU â†’ cĂ¡c OWNER/MANAGER khĂ¡c (trá»« ngÆ°á»i vá»«a táº¡o).
    // Bá»c try/catch riĂªng: lá»—i push KHĂ”NG Ä‘Æ°á»£c lĂ m há»ng luá»“ng táº¡o phiáº¿u.
    if (loaiGiaoDich === 'THU') {

      try {
        await notifyManagers(
          {
            title: 'đŸ’° CĂ³ phiáº¿u Thu má»›i',
            body: `${newThuChi.maPhieu} Â· ${Number(newThuChi.soTien).toLocaleString('vi-VN')}Ä‘ â€” ${newThuChi.noiDung}`,
            url: '/thu-chi',
            tag: 'thu-chi-thu',
          },
          { excludeUserId: user.id }
        );
      } catch (pushErr) {
        logger.error('notifyManagers (phiáº¿u Thu)', pushErr);
      }
    }

    return NextResponse.json({
      success: true,
      thuChi: newThuChi,
      message: `ÄĂ£ ghi nháº­n phiáº¿u ${loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'} ${newThuChi.maPhieu} thĂ nh cĂ´ng.`,
    });
  } catch (error) {
    logger.error('POST /api/thu-chi', error);
    return NextResponse.json(
      { error: 'ÄĂ£ xáº£y ra lá»—i trĂªn há»‡ thá»‘ng.' },
      { status: 500 }
    );
  }
}


