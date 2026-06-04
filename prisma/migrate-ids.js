require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function parseId(id) {
  let m = id.match(/^(CP|TC)-(\d{2})(\d{2})\d{2}-(\d{4})$/);
  if (m) return { prefix: m[1], yymm: `${m[2]}${m[3]}` };
  m = id.match(/^(CP|TC)(\d{4})-(\d{4})$/);
  if (m) return { prefix: m[1], yymm: m[2] };
  return null;
}

function getYYMMFromDate(date, prefix) {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return { prefix, yymm: `${yy}${mm}` };
}

async function migrateDeXuat() {
  console.log('--- De xuat chi phi ---');
  const all = await prisma.deXuatChiPhi.findMany({
    select: { id: true, maPhieu: true, ngayPhatSinh: true },
    orderBy: { ngayPhatSinh: 'asc' },
  });

  const groups = {};
  for (const rec of all) {
    let parsed = parseId(rec.maPhieu);
    if (!parsed) parsed = getYYMMFromDate(rec.ngayPhatSinh, 'CP');
    const key = `${parsed.prefix}${parsed.yymm}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rec);
  }

  // Phase 1: all to temp
  for (const records of Object.values(groups)) {
    for (const rec of records) {
      await prisma.deXuatChiPhi.update({
        where: { id: rec.id },
        data: { maPhieu: `_T_${rec.id.slice(0, 20)}` },
      });
    }
  }

  // Phase 2: assign sequential
  let count = 0;
  for (const [key, records] of Object.entries(groups)) {
    for (let i = 0; i < records.length; i++) {
      const newMa = `${key}-${String(i + 1).padStart(4, '0')}`;
      await prisma.deXuatChiPhi.update({
        where: { id: records[i].id },
        data: { maPhieu: newMa },
      });
      console.log(`  ${records[i].maPhieu} -> ${newMa}`);
      count++;
    }
  }
  console.log(`\nDa chuyen ${count}/${all.length} ma de xuat.\n`);
}

async function migrateThuChi() {
  console.log('--- Thu-Chi ---');
  const all = await prisma.thuChi.findMany({
    select: { id: true, maPhieu: true, ngayGiaoDich: true },
    orderBy: { ngayGiaoDich: 'asc' },
  });

  const groups = {};
  for (const rec of all) {
    let parsed = parseId(rec.maPhieu);
    if (!parsed) parsed = getYYMMFromDate(rec.ngayGiaoDich, 'TC');
    const key = `${parsed.prefix}${parsed.yymm}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rec);
  }

  for (const records of Object.values(groups)) {
    for (const rec of records) {
      await prisma.thuChi.update({
        where: { id: rec.id },
        data: { maPhieu: `_T_${rec.id.slice(0, 20)}` },
      });
    }
  }

  let count = 0;
  for (const [key, records] of Object.entries(groups)) {
    for (let i = 0; i < records.length; i++) {
      const newMa = `${key}-${String(i + 1).padStart(4, '0')}`;
      await prisma.thuChi.update({
        where: { id: records[i].id },
        data: { maPhieu: newMa },
      });
      console.log(`  ${records[i].maPhieu} -> ${newMa}`);
      count++;
    }
  }
  console.log(`\nDa chuyen ${count}/${all.length} ma thu-chi.\n`);
}

async function migrate() {
  console.log('=== Chuyen doi ID format ===\n');
  await migrateDeXuat();
  await migrateThuChi();
  console.log('=== Hoan tat! ===');
}

migrate()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
