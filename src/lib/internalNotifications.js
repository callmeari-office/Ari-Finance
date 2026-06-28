import { randomUUID } from 'crypto';
import { prisma } from './prisma';

export const THU_CREATED_INTERNAL_NOTIFICATION_TITLE = 'Co phieu Thu moi';

export function buildThuCreatedInternalNotificationNeedle(maPhieu) {
  return `phiếu THU ${maPhieu}:`;
}

export function buildThuCreatedInternalNotification({
  maPhieu,
  soTien,
  noiDung,
  tenQuy,
  tenNguoiTao,
}) {
  const soTienFmt = Number(soTien || 0).toLocaleString('vi-VN');
  const creator = tenNguoiTao?.trim() || 'He thong';
  const fundName = tenQuy?.trim() || 'khong ro quy';
  const detail = noiDung?.trim() || 'Khong co noi dung';

  return {
    tieuDe: THU_CREATED_INTERNAL_NOTIFICATION_TITLE,
    noiDung: `${creator} vua ghi nhan phiếu THU ${maPhieu}: +${soTienFmt}đ vao quy ${fundName} - ${detail}`,
    tag: 'THONG_TIN',
  };
}

export async function createThuCreatedInternalNotification({
  thuChi,
  quy,
  user,
}) {
  const payload = buildThuCreatedInternalNotification({
    maPhieu: thuChi?.maPhieu,
    soTien: thuChi?.soTien,
    noiDung: thuChi?.noiDung,
    tenQuy: quy?.tenQuy,
    tenNguoiTao: user?.tenNgan || user?.hoTen || user?.username,
  });

  await prisma.$executeRaw`
    INSERT INTO "ThongBaoNoiBo"
      ("id", "tieuDe", "noiDung", "tag", "ngayHetHan", "trangThai", "nguoiTaoId", "tenNguoiTao", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${payload.tieuDe}, ${payload.noiDung}, ${payload.tag}, NULL, 'ACTIVE', ${user.id}, ${user.tenNgan || user.hoTen || user.username || 'He thong'}, NOW(), NOW())
  `;

  return payload;
}

export async function archiveThuCreatedInternalNotificationsByReceiptCode(db, maPhieu) {
  if (!maPhieu) return 0;

  const needle = `%${buildThuCreatedInternalNotificationNeedle(maPhieu)}%`;

  return db.$executeRaw`
    UPDATE "ThongBaoNoiBo"
    SET "trangThai" = 'ARCHIVED',
        "updatedAt" = NOW()
    WHERE "trangThai" = 'ACTIVE'
      AND "tieuDe" = ${THU_CREATED_INTERNAL_NOTIFICATION_TITLE}
      AND "noiDung" LIKE ${needle}
  `;
}
