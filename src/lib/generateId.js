import { prisma } from '@/lib/prisma';

function getYYMM() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

async function getNextNumber(model, field, prefix) {
  const last = await prisma[model].findFirst({
    where: { [field]: { startsWith: prefix } },
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  });

  if (!last) return 1;

  const parts = last[field].split('-');
  const num = parseInt(parts[parts.length - 1], 10);
  return (isNaN(num) ? 0 : num) + 1;
}

// CP2605-0001
export async function generateMaDeXuat() {
  const prefix = `CP${getYYMM()}-`;
  const next = await getNextNumber('deXuatChiPhi', 'maPhieu', prefix);
  return `${prefix}${String(next).padStart(4, '0')}`;
}

// TC2605-0001
export async function generateMaThuChi() {
  const prefix = `TC${getYYMM()}-`;
  const next = await getNextNumber('thuChi', 'maPhieu', prefix);
  return `${prefix}${String(next).padStart(4, '0')}`;
}

// NCC-0001
export async function generateMaNCC() {
  const prefix = 'NCC-';
  const next = await getNextNumber('nhaCungCap', 'id', prefix);
  return `${prefix}${String(next).padStart(4, '0')}`;
}
