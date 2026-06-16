// src/lib/dinhKy.js
// Logic tạo phiếu chi từ mẫu PhieuDinhKy cho 1 tháng — dùng chung cho nút tay + cron.
import { prisma as defaultPrisma } from '@/lib/prisma';
import { generateMaDeXuat } from '@/lib/generateId';
import { ghiNhatKy } from '@/lib/audit';

/**
 * Tạo phiếu định kỳ cho tháng/năm chỉ định từ các mẫu đang active.
 * Idempotent: bỏ qua mẫu đã có phiếu (cùng noiDung + danhMucId) trong tháng (trạng thái != HUY).
 * @returns {Promise<{created: {id:string, trangThai:string}[], skipped: string[]}>}
 */
export async function taoPhieuDinhKyChoThang(prisma, { nam, thang, nguoiTaoId, user }) {
  const db = prisma || defaultPrisma;
  const templates = await db.$queryRawUnsafe(
    `SELECT * FROM "PhieuDinhKy" WHERE "active" = true ORDER BY "createdAt" ASC`
  );

  const created = [];
  const skipped = [];
  if (!templates.length) return { created, skipped };

  const startOfMonth = new Date(Date.UTC(nam, thang - 1, 1));
  const startOfNext = new Date(Date.UTC(nam, thang, 1));
  const lastDay = new Date(nam, thang, 0).getDate();

  for (const tpl of templates) {
    const ngay = Math.min(tpl.ngayChiTrongThang, lastDay);
    const ngayPhatSinh = new Date(Date.UTC(nam, thang - 1, ngay));

    const existing = await db.deXuatChiPhi.findFirst({
      where: {
        noiDung: tpl.noiDung,
        danhMucId: tpl.danhMucId,
        ngayPhatSinh: { gte: startOfMonth, lt: startOfNext },
        trangThai: { not: 'HUY' },
      },
      select: { id: true },
    });
    if (existing) { skipped.push(tpl.tenMau); continue; }

    const maPhieu = await generateMaDeXuat();
    const proposal = await db.deXuatChiPhi.create({
      data: {
        maPhieu,
        ngayPhatSinh,
        danhMucId: tpl.danhMucId,
        noiDung: tpl.noiDung,
        soTien: tpl.soTien,
        nhaCungCapId: tpl.nhaCungCapId || null,
        nguonTien: tpl.nguonTien,
        trangThai: tpl.trangThaiMacDinh,
        ghiChu: tpl.ghiChu || null,
        nguoiTaoId,
        ngayCanThanhToan: ngayPhatSinh,
      },
      select: { id: true },
    });
    created.push({ id: proposal.id, trangThai: tpl.trangThaiMacDinh });

    if (user) {
      await ghiNhatKy({
        user,
        hanhDong: 'TAO',
        doiTuong: 'DE_XUAT',
        maDoiTuong: maPhieu,
        moTa: `Tạo phiếu định kỳ từ mẫu "${tpl.tenMau}" — Tháng ${thang}/${nam}`,
      });
    }
  }

  return { created, skipped };
}
