-- ============================================================
-- Reset dữ liệu test — chuẩn bị go-live
-- Chạy: npx prisma db execute --file ./prisma/reset-test-data.sql
-- Ngày tạo: 2026-06-11
-- ============================================================

-- 1. Xóa đề xuất chi phí (có FK đến ThuChi → xóa trước)
DELETE FROM "DeXuatChiPhi";

-- 2. Xóa phiếu thu-chi
DELETE FROM "ThuChi";

-- 3. Xóa nhật ký thao tác (audit log)
DELETE FROM "LichSuThaoTac";

-- 4. Xóa thông báo nội bộ
DELETE FROM "ThongBaoNoiBo";

-- 5. Reset khoản điều chỉnh số dư thủ công về 0
UPDATE "Quy" SET "soDuDieuChinh" = 0;
