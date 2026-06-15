-- Thêm cột phân quyền xem NCC theo vai trò (JSON mảng vai trò; NULL = mọi vai trò xem được)
-- Idempotent: chạy lại nhiều lần không lỗi.
ALTER TABLE "NhaCungCap" ADD COLUMN IF NOT EXISTS "chucVuDuocXem" TEXT;
