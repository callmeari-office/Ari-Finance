import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

// POST /api/quy/[id]/dieu-chinh
// OWNER cân bằng số dư quỹ về một con số thực tế mà KHÔNG tạo phiếu thu-chi.
// Body: { soDuMucTieu: number, lyDo?: string }
// Hệ thống tính phần chênh và lưu vào cột soDuDieuChinh (không đụng sổ thu-chi / doanh thu).
export async function POST(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json({ error: 'Chỉ Chủ shop (Owner) mới có quyền điều chỉnh số dư quỹ.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { soDuMucTieu, lyDo } = body;

    if (soDuMucTieu === undefined || soDuMucTieu === null || isNaN(Number(soDuMucTieu))) {
      return NextResponse.json({ error: 'Vui lòng nhập số dư thực tế hợp lệ.' }, { status: 400 });
    }
    const target = lamTronTien(soDuMucTieu);

    const quy = await prisma.quy.findUnique({ where: { id } });
    if (!quy) return NextResponse.json({ error: 'Không tìm thấy quỹ.' }, { status: 404 });

    // Tính số dư hiện tại (chưa gồm điều chỉnh) từ sổ thu-chi
    const agg = await prisma.thuChi.groupBy({
      by: ['loaiGiaoDich'],
      where: { quyId: id },
      _sum: { soTien: true },
    });
    const tongThu = agg.filter((a) => a.loaiGiaoDich === 'THU').reduce((s, a) => s + (a._sum.soTien ?? 0), 0);
    const tongChi = agg.filter((a) => a.loaiGiaoDich === 'CHI').reduce((s, a) => s + (a._sum.soTien ?? 0), 0);

    const base = quy.soDuDauKy + tongThu - tongChi; // số dư "tự nhiên" chưa điều chỉnh
    const soDuTruoc = base + (quy.soDuDieuChinh ?? 0); // số dư đang hiển thị trước khi chỉnh
    const soDuDieuChinhMoi = target - base; // offset mới để số dư = target
    const chenhLech = target - soDuTruoc;

    const updated = await prisma.quy.update({
      where: { id },
      data: { soDuDieuChinh: soDuDieuChinhMoi },
    });

    const fmt = (n) => Number(n).toLocaleString('vi-VN') + 'đ';
    await ghiNhatKy({
      user,
      hanhDong: 'DIEU_CHINH',
      doiTuong: 'QUY',
      maDoiTuong: id,
      moTa: `Điều chỉnh số dư quỹ "${quy.tenQuy}": ${fmt(soDuTruoc)} → ${fmt(target)} (chênh ${chenhLech >= 0 ? '+' : ''}${fmt(chenhLech)})${lyDo ? ` — Lý do: ${String(lyDo).slice(0, 300)}` : ''}`,
    });

    return NextResponse.json({
      success: true,
      message: `Đã điều chỉnh số dư quỹ "${quy.tenQuy}" về ${fmt(target)}.`,
      quy: updated,
      soDuTruoc,
      soDuSau: target,
      chenhLech,
    });
  } catch (error) {
    logger.error('POST /api/quy/[id]/dieu-chinh', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
