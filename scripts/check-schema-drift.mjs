/**
 * check-schema-drift.mjs — Dò lệch giữa prisma/schema.prisma và DB thật (READ-ONLY).
 *
 * Bắt đúng lớp lỗi "schema có cột nhưng DB chưa có" (vd loaiDoiTuong, Đợt 12-17) —
 * loại lỗi làm trắng trang / mất data vì Prisma client luôn SELECT cột đó.
 *
 * Dùng:  node scripts/check-schema-drift.mjs     (hoặc: npm run db:check)
 * Không sửa gì DB. Exit code 1 nếu phát hiện drift (tiện chạy trong CI/trước deploy).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCALARS = new Set(['String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Json', 'Bytes']);

// --- Parse schema.prisma → { table: Set<columns> } ---
function parseSchema(src) {
  const tables = {};
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = modelRe.exec(src))) {
    const modelName = m[1];
    const body = m[2];
    let tableName = modelName;
    const cols = new Set();
    for (const raw of body.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      if (line.startsWith('@@map')) {
        const mm = line.match(/@@map\("([^"]+)"\)/);
        if (mm) tableName = mm[1];
        continue;
      }
      if (line.startsWith('@@')) continue; // @@index, @@unique...
      const parts = line.split(/\s+/);
      const field = parts[0];
      const type = (parts[1] || '').replace(/[?\[\]]/g, '');
      if (!SCALARS.has(type)) continue; // bỏ qua quan hệ (relation) — không phải cột
      const mapMatch = line.match(/@map\("([^"]+)"\)/);
      cols.add(mapMatch ? mapMatch[1] : field);
    }
    tables[tableName] = cols;
  }
  return tables;
}

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const tables = parseSchema(fs.readFileSync(schemaPath, 'utf8'));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// retry kết nối (Supabase free-tier đôi khi từ chối connection tạm thời)
async function connectWithRetry(tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try { await pool.query('SELECT 1'); return true; }
    catch (e) {
      console.log(`  …kết nối thử ${i}/${tries}: ${e.code || e.message}`);
      if (i < tries) await new Promise((r) => setTimeout(r, 2500));
    }
  }
  return false;
}

const ok = await connectWithRetry();
if (!ok) { console.error('❌ Không kết nối được DB (sự cố hạ tầng tạm thời). Thử lại sau.'); await pool.end(); process.exit(2); }

const { rows } = await pool.query(
  `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
);
const dbCols = {};
for (const r of rows) (dbCols[r.table_name] ||= new Set()).add(r.column_name);

let drift = 0;
console.log('=== DÒ LỆCH SCHEMA ⇄ DB ===\n');
for (const [table, cols] of Object.entries(tables)) {
  if (!dbCols[table]) { console.log(`⚠️  BẢNG THIẾU trong DB: ${table}`); drift++; continue; }
  const missing = [...cols].filter((c) => !dbCols[table].has(c));
  if (missing.length) {
    console.log(`❌ ${table}: DB THIẾU cột → ${missing.join(', ')}`);
    drift++;
  }
}

if (!drift) console.log('✅ Không phát hiện lệch — schema.prisma khớp DB hoàn toàn.');
else console.log(`\n⛔ Phát hiện ${drift} điểm lệch. Chạy migration SQL tương ứng rồi thử lại.`);

await pool.end();
process.exit(drift ? 1 : 0);
