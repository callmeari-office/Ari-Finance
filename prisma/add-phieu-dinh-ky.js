// Migration: Tạo bảng PhieuDinhKy (phiếu chi định kỳ hàng tháng)
// Chạy: node prisma/add-phieu-dinh-ky.js
require('dotenv').config();
const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('Tạo bảng PhieuDinhKy...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PhieuDinhKy" (
      "id"                TEXT PRIMARY KEY,
      "tenMau"            TEXT NOT NULL,
      "noiDung"           TEXT NOT NULL,
      "soTien"            DOUBLE PRECISION NOT NULL,
      "danhMucId"         TEXT NOT NULL,
      "nhaCungCapId"      TEXT,
      "nguonTien"         TEXT NOT NULL,
      "trangThaiMacDinh"  TEXT NOT NULL DEFAULT 'CHO_THANH_TOAN',
      "ngayChiTrongThang" INTEGER NOT NULL DEFAULT 1,
      "ghiChu"            TEXT,
      "active"            BOOLEAN NOT NULL DEFAULT true,
      "nguoiTaoId"        TEXT NOT NULL,
      "createdAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "PhieuDinhKy_active_idx" ON "PhieuDinhKy"("active")
  `);

  console.log('Hoàn thành! Bảng PhieuDinhKy đã được tạo.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
