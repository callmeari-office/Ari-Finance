-- Bảng tham số hệ thống key–value. Chạy:
--   npx prisma db execute --file ./prisma/add-cauhinh.sql
-- (Prisma 7 đọc connection từ prisma.config.ts — KHÔNG dùng --schema)
CREATE TABLE IF NOT EXISTS "CauHinh" (
  "khoa"    TEXT NOT NULL,
  "giaTri"  TEXT NOT NULL,
  "capNhat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CauHinh_pkey" PRIMARY KEY ("khoa")
);

-- Mặc định cửa sổ "sắp tới hạn" = 7 ngày (idempotent).
INSERT INTO "CauHinh" ("khoa", "giaTri")
VALUES ('soNgaySapToiHan', '7')
ON CONFLICT ("khoa") DO NOTHING;
