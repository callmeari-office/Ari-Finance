-- Migration: thêm cột nguoiDeXuatId vào DeXuatChiPhi
-- Mục đích: tách "người đề xuất" (chủ sở hữu nghiệp vụ khoản chi — dùng cho
-- quyền xem, hoàn ứng, thống kê, thông báo) khỏi "người tạo" (nguoiTaoId —
-- ai bấm nút tạo, giữ nguyên ý nghĩa audit). Cho phép tạo giúp phiếu cho NV khác.
-- Chạy: npx prisma db execute --file ./prisma/add-nguoi-de-xuat.sql

ALTER TABLE "DeXuatChiPhi" ADD COLUMN IF NOT EXISTS "nguoiDeXuatId" TEXT;

-- Backfill dữ liệu cũ: người đề xuất = người tạo (chưa từng có khái niệm tạo giúp)
UPDATE "DeXuatChiPhi" SET "nguoiDeXuatId" = "nguoiTaoId" WHERE "nguoiDeXuatId" IS NULL;

ALTER TABLE "DeXuatChiPhi" ALTER COLUMN "nguoiDeXuatId" SET NOT NULL;

ALTER TABLE "DeXuatChiPhi"
  ADD CONSTRAINT "DeXuatChiPhi_nguoiDeXuatId_fkey"
    FOREIGN KEY ("nguoiDeXuatId") REFERENCES "NhanVien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "DeXuatChiPhi_nguoiDeXuatId_idx" ON "DeXuatChiPhi"("nguoiDeXuatId");
