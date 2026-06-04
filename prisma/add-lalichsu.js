// Migration nhỏ: thêm cột laLichSu vào DeXuatChiPhi (idempotent, an toàn chạy lại).
// Chạy: node prisma/add-lalichsu.js
require('dotenv').config();
const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await pool.query(
    'ALTER TABLE "DeXuatChiPhi" ADD COLUMN IF NOT EXISTS "laLichSu" BOOLEAN NOT NULL DEFAULT false;'
  );
  console.log('✓ Đã thêm cột laLichSu (hoặc đã tồn tại sẵn).');
  await pool.end();
}

main().catch((e) => {
  console.error('Lỗi migration:', e);
  process.exit(1);
});
