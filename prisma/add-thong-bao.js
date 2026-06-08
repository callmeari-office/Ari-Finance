/**
 * Script tạo bảng ThongBaoNoiBo — chạy một lần (idempotent).
 * Windows/Prisma 7: không dùng db push/migrate, dùng raw SQL.
 * Chạy: node prisma/add-thong-bao.js
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Thiếu biến môi trường DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ThongBaoNoiBo" (
        "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
        "tieuDe"      TEXT        NOT NULL,
        "noiDung"     TEXT        NOT NULL,
        "tag"         TEXT        NOT NULL DEFAULT 'THONG_TIN',
        "ngayHetHan"  TIMESTAMPTZ,
        "trangThai"   TEXT        NOT NULL DEFAULT 'ACTIVE',
        "nguoiTaoId"  TEXT        NOT NULL,
        "tenNguoiTao" TEXT        NOT NULL,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("id")
      );
    `);
    console.log('✓ Bảng ThongBaoNoiBo đã sẵn sàng (CREATE TABLE IF NOT EXISTS).');

    await client.query(`
      CREATE INDEX IF NOT EXISTS "ThongBaoNoiBo_trangThai_idx" ON "ThongBaoNoiBo" ("trangThai");
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "ThongBaoNoiBo_ngayHetHan_idx" ON "ThongBaoNoiBo" ("ngayHetHan");
    `);
    console.log('✓ Index đã sẵn sàng.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
