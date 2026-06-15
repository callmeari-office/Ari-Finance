import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaNCC } from '@/lib/generateId';
import { canViewNcc, parseChucVuDuocXem } from '@/lib/roles';

const ALL_VIEW_ROLES = ['MANAGER', 'LEADER', 'STAFF'];

// Chuẩn hoá danh sách vai trò được xem (chỉ OWNER/MANAGER mới được set).
// - Không phải mảng → null (mọi vai trò xem được — mặc định).
// - Đủ cả 3 vai trò → null (mọi vai trò xem được).
// - Tập con (kể cả rỗng = chỉ Owner) → JSON chuỗi.
function normalizeChucVu(input) {
  if (!Array.isArray(input)) return null;
  const clean = [...new Set(input.filter((r) => ALL_VIEW_ROLES.includes(r)))];
  if (clean.length >= ALL_VIEW_ROLES.length) return null;
  return JSON.stringify(clean);
}

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(user.role);

    const vendors = await prisma.nhaCungCap.findMany({
      // Số liệu chi tiêu là nhạy cảm → chỉ kéo về cho OWNER/MANAGER
      include: isOwnerOrManager
        ? { thuChi: { where: { loaiGiaoDich: 'CHI' }, select: { soTien: true } } }
        : undefined,
      orderBy: { tenNCC: 'asc' },
    });

    const result = vendors
      .filter((v) => canViewNcc(user.role, parseChucVuDuocXem(v.chucVuDuocXem)))
      .map((v) => {
        const base = {
          id: v.id,
          tenNCC: v.tenNCC,
          tenTaiKhoan: v.tenTaiKhoan,
          soTaiKhoan: v.soTaiKhoan,
          tenNganHang: v.tenNganHang,
          maQR: v.maQR,
        };
        // Quyền xem + số liệu chi tiêu: chỉ trả cho OWNER/MANAGER
        if (isOwnerOrManager) {
          base.chucVuDuocXem = parseChucVuDuocXem(v.chucVuDuocXem);
          base.tongDaChi = v.thuChi.reduce((sum, item) => sum + item.soTien, 0);
          base.soPhieuChi = v.thuChi.length;
        }
        return base;
      });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('GET /api/ncc', error);
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
    const { id, tenNCC, tenTaiKhoan, soTaiKhoan, tenNganHang, maQR, chucVuDuocXem } = body;

    if (!tenNCC || !soTaiKhoan || !tenNganHang) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc (Tên NCC, STK, Ngân hàng).' }, { status: 400 });
    }

    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(user.role);
    // Chỉ OWNER/MANAGER được giới hạn quyền xem; còn lại mặc định xem hết (null).
    const finalChucVu = isOwnerOrManager ? normalizeChucVu(chucVuDuocXem) : null;

    // Auto generate ID if not provided
    let finalId = id ? id.trim().toUpperCase() : null;
    if (!finalId) {
      finalId = await generateMaNCC();
    }

    // Check duplicate ID
    const exists = await prisma.nhaCungCap.findUnique({ where: { id: finalId } });
    if (exists) {
      return NextResponse.json({ error: `Mã nhà cung cấp [${finalId}] đã tồn tại.` }, { status: 400 });
    }

    const newVendor = await prisma.nhaCungCap.create({
      data: {
        id: finalId,
        tenNCC: tenNCC.trim(),
        tenTaiKhoan: tenTaiKhoan ? tenTaiKhoan.trim() : null,
        soTaiKhoan: soTaiKhoan.trim(),
        tenNganHang: tenNganHang.trim(),
        maQR: maQR || null,
        chucVuDuocXem: finalChucVu,
      },
    });

    return NextResponse.json({
      success: true,
      vendor: newVendor,
      message: `Đã tạo nhà cung cấp [${finalId}] thành công.`,
    });
  } catch (error) {
    logger.error('POST /api/ncc', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
