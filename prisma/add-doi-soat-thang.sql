-- Migration: tạo bảng DoiSoatThang
-- Mục đích: lưu ghi chú đối soát doanh thu theo tháng (lý do chênh lệch KH vs thực tế)
-- Bảng độc lập, không khóa ngoại.
-- Chạy: npx prisma db execute --file ./prisma/add-doi-soat-thang.sql

CREATE TABLE IF NOT EXISTS "DoiSoatThang" (
  "id"        TEXT NOT NULL,
  "nam"       INTEGER NOT NULL,
  "thang"     INTEGER NOT NULL,
  "ghiChu"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DoiSoatThang_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DoiSoatThang_nam_thang_key" ON "DoiSoatThang"("nam", "thang");
