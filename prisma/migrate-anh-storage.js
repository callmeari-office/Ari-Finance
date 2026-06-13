/**
 * Migration 1-shot: chuyển anhHoaDon từ base64 sang Supabase Storage URL.
 *
 * Chạy 1 lần trước khi deploy code mới:
 *   node prisma/migrate-anh-storage.js
 *
 * Yêu cầu:
 *   - .env có SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 *   - Bucket "hoa-don" đã tạo trong Supabase Storage (public)
 *   - @supabase/supabase-js đã cài (có trong package.json)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { randomUUID } = require('crypto');

const STORAGE_BUCKET = 'hoa-don';

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // Chỉ lấy phiếu có ảnh dạng base64 (bắt đầu bằng 'data:')
  const proposals = await prisma.deXuatChiPhi.findMany({
    where: { anhHoaDon: { startsWith: 'data:' } },
    select: { id: true, maPhieu: true, anhHoaDon: true },
  });

  console.log(`Tìm thấy ${proposals.length} phiếu cần migrate ảnh.`);
  if (proposals.length === 0) {
    console.log('Không có gì để migrate. Đã xong.');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const prop of proposals) {
    const dataUrl = prop.anhHoaDon;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) {
      console.warn(`  [SKIP] ${prop.maPhieu} — data URL không đúng định dạng`);
      fail++;
      continue;
    }

    const mime = match[1];
    const buf = Buffer.from(match[2], 'base64');
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
    const filename = `${randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, buf, { contentType: mime, upsert: false });

    if (uploadErr) {
      console.error(`  [FAIL] ${prop.maPhieu} — ${uploadErr.message}`);
      fail++;
      continue;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename);

    await prisma.deXuatChiPhi.update({
      where: { id: prop.id },
      data: { anhHoaDon: publicUrl },
    });

    console.log(`  [OK]   ${prop.maPhieu} → ${publicUrl}`);
    ok++;
  }

  console.log(`\nHoàn thành: ${ok} thành công, ${fail} thất bại.`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
