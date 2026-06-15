-- 1. Bổ sung cột loaiDoiTuong vào bảng NhaCungCap
ALTER TABLE "NhaCungCap" ADD COLUMN IF NOT EXISTS "loaiDoiTuong" TEXT NOT NULL DEFAULT 'NCC';

-- 2. Cập nhật quyền ncc: true cho STAFF và LEADER
UPDATE "VaiTroQuyen"
SET "permissions" = jsonb_set("permissions"::jsonb, '{ncc}', 'true')::text
WHERE "role" IN ('STAFF', 'LEADER');
