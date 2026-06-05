// Migration: Tạo bảng PasswordResetToken
// Chạy: node prisma/add-password-reset.js
require('dotenv').config();
const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('Tạo bảng PasswordResetToken...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      "id"         TEXT PRIMARY KEY,
      "token"      TEXT UNIQUE NOT NULL,
      "nhanVienId" TEXT NOT NULL,
      "expiresAt"  TIMESTAMP WITH TIME ZONE NOT NULL,
      "used"       BOOLEAN NOT NULL DEFAULT false,
      "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "PasswordResetToken_nhanVienId_idx"
    ON "PasswordResetToken"("nhanVienId")
  `);

  console.log('Hoàn thành! Bảng PasswordResetToken đã được tạo.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
