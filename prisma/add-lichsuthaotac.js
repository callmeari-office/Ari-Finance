// Migration nhỏ: tạo bảng LichSuThaoTac (nhật ký thao tác) — idempotent, an toàn chạy lại.
// Chạy: node prisma/add-lichsuthaotac.js
require('dotenv').config();
const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "LichSuThaoTac" (
      "id"           TEXT PRIMARY KEY,
      "thoiGian"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "nguoiDungId"  TEXT,
      "tenNguoiDung" TEXT,
      "vaiTro"       TEXT,
      "hanhDong"     TEXT NOT NULL,
      "doiTuong"     TEXT,
      "maDoiTuong"   TEXT,
      "moTa"         TEXT
    );
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS "LichSuThaoTac_thoiGian_idx" ON "LichSuThaoTac" ("thoiGian");'
  );
  console.log('✓ Đã tạo bảng LichSuThaoTac (hoặc đã tồn tại sẵn).');
  await pool.end();
}

main().catch((e) => {
  console.error('Lỗi migration:', e);
  process.exit(1);
});
