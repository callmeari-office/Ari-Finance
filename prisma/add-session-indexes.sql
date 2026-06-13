-- Thêm index cho bảng Session để tăng tốc lookup và cleanup phiên hết hạn
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
