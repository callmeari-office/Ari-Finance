-- Migration: thêm cột buTruLichSu vào ThuChi
-- Mục đích: đánh dấu phiếu bù trừ lịch sử (CHI+THU tự triệt tiêu)
-- để loại khỏi avgChiNgay, thống kê tháng, báo cáo lợi nhuận.
ALTER TABLE "ThuChi" ADD COLUMN IF NOT EXISTS "buTruLichSu" BOOLEAN NOT NULL DEFAULT FALSE;
