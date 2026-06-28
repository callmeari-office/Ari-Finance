import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaDeXuat, withUniqueCodeRetry } from '@/lib/generateId';
import { notifyManagersChoThanhToan } from '@/lib/email';
import { notifyManagers as pushNotifyManagers } from '@/lib/webpush';
import { canViewCategory, isRestrictedToOwnProposals, getEffectiveRoles } from '@/lib/roles';
import { ghiNhatKy } from '@/lib/audit';
import { validateStorageImageUrl } from '@/lib/validateImage';
import { VALID_NGUON_TIEN, resolveCreateProposalStatus } from '@/lib/proposalWorkflow';
import { buildProposalDateWhere, buildProposalStatusWhere } from './filters';

const DEFAULT_LIMIT = 20;

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'ChÆ°a Ä‘Äƒng nháº­p.' }, { status: 401 });
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

    // Staff (vĂ  Leader) chá»‰ tháº¥y Ä‘á» xuáº¥t cá»§a mĂ¬nh
    if (isRestrictedToOwnProposals(user.role)) {
      where.nguoiTaoId = user.id;
    } else if (nguoiTaoId) {
      where.nguoiTaoId = { in: nguoiTaoId.split(',').map(s => s.trim()).filter(Boolean) };
    }

    // Lá»c theo nÄƒm vĂ  thĂ¡ng cá»§a ngayPhatSinh (há»— trá»£ multi-select)
    const dateWhere = buildProposalDateWhere(nam, thang);
    if (dateWhere) {
      where.AND = [
        ...(where.AND || []),
        dateWhere,
      ];
    }

    // TĂ¬m kiáº¿m (mĂ£ phiáº¿u, ná»™i dung, tĂªn NCC)
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

    // [M5] Lá»c quyá»n danh má»¥c táº¡i DB Ä‘á»ƒ count/sum/pagination nháº¥t quĂ¡n
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

    // Kiá»ƒm tra URL áº£nh hĂ³a Ä‘Æ¡n náº¿u cĂ³ gá»­i lĂªn
    if (anhHoaDon) {
      const imgError = validateStorageImageUrl(anhHoaDon);
      if (imgError) {
        return NextResponse.json({ error: imgError }, { status: 400 });
      }
    }

    if (!ngayPhatSinh || !danhMucId || !noiDung || !soTien || !nguonTien) {
      return NextResponse.json(
        { error: 'Vui lĂ²ng cung cáº¥p Ä‘áº§y Ä‘á»§ thĂ´ng tin báº¯t buá»™c.' },
        { status: 400 }
      );
    }

    if (typeof noiDung !== 'string' || noiDung.trim().length === 0 || noiDung.length > 500) {
      return NextResponse.json(
        { error: 'Ná»™i dung Ä‘á» xuáº¥t khĂ´ng há»£p lá»‡ (1â€“500 kĂ½ tá»±).' },
        { status: 400 }
      );
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json(
        { error: 'Sá»‘ tiá»n Ä‘á» xuáº¥t pháº£i lá»›n hÆ¡n 0.' },
        { status: 400 }
      );
    }
    if (!VALID_NGUON_TIEN.includes(nguonTien)) {
      return NextResponse.json({ error: 'Nguá»“n tiá»n khĂ´ng há»£p lá»‡.' }, { status: 400 });
    }
    const finalTrangThai = resolveCreateProposalStatus({
      role: user.role,
      nguonTien,
      requestedTrangThai: trangThai,
    });

    const danhMuc = await prisma.danhMuc.findUnique({ where: { id: danhMucId } });
    if (!danhMuc) {
      return NextResponse.json({ error: 'Danh má»¥c chi phĂ­ khĂ´ng há»£p lá»‡.' }, { status: 400 });
    }

    try {
      const allowedRoles = JSON.parse(danhMuc.chucVuDuocXem);
      if (!canViewCategory(user.role, allowedRoles)) {
        return NextResponse.json(
          { error: 'Báº¡n khĂ´ng cĂ³ quyá»n chá»n danh má»¥c chi phĂ­ nĂ y.' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'Lá»—i kiá»ƒm tra quyá»n danh má»¥c.' }, { status: 500 });
    }

    if (danhMuc.yeuCauNCC && !nhaCungCapId) {
      return NextResponse.json(
        { error: `Danh má»¥c "${danhMuc.tenDanhMuc}" yĂªu cáº§u pháº£i chá»n NhĂ  cung cáº¥p.` },
        { status: 400 }
      );
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
      moTa: `Táº¡o Ä‘á» xuáº¥t "${newProposal.noiDung}" â€” ${Number(newProposal.soTien).toLocaleString('vi-VN')}Ä‘`,
    });

    // Gá»­i email thĂ´ng bĂ¡o cho OWNER + MANAGER khi phiáº¿u á»Ÿ tráº¡ng thĂ¡i "Chá» thanh toĂ¡n".
    // Await Ä‘á»ƒ cháº¯c cháº¯n email Ä‘Æ°á»£c gá»­i trĂªn mĂ´i trÆ°á»ng serverless, nhÆ°ng hĂ m nĂ y
    // tá»± báº¯t lá»—i bĂªn trong nĂªn KHĂ”NG lĂ m há»ng luá»“ng táº¡o phiáº¿u náº¿u gá»­i mail tháº¥t báº¡i.
    if (newProposal.trangThai === 'CHO_THANH_TOAN') {
      await notifyManagersChoThanhToan(newProposal.id);
      // Gá»­i push notification song song vá»›i email (tá»± báº¯t lá»—i bĂªn trong)
      pushNotifyManagers({
        title: 'Phiáº¿u má»›i chá» duyá»‡t',
        body: `${newProposal.noiDung} â€” ${Number(newProposal.soTien).toLocaleString('vi-VN')}Ä‘`,
        url: '/de-xuat/duyet?open=' + newProposal.id,
        tag: 'phieu-' + newProposal.id,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      proposal: newProposal,
      message: `ÄĂ£ táº¡o Ä‘á» xuáº¥t ${newProposal.maPhieu} thĂ nh cĂ´ng.`,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat', error);
    return NextResponse.json(
      { error: 'ÄĂ£ xáº£y ra lá»—i trĂªn há»‡ thá»‘ng.' },
      { status: 500 }
    );
  }
}
