import { prisma } from '@/lib/prisma';
import {
  buildSequentialCodes,
  getNextSequentialNumber,
  isUniqueConstraintError,
} from '@/lib/generateIdCore';

const UNIQUE_CODE_RETRY_LIMIT = 5;

function getYYMM() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

async function getNextNumber(model, field, prefix, client = prisma) {
  const last = await client[model].findFirst({
    where: { [field]: { startsWith: prefix } },
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  });

  return getNextSequentialNumber(last?.[field]);
}

export async function allocateSequentialCodes({ model, field, prefix, count, client = prisma }) {
  const next = await getNextNumber(model, field, prefix, client);
  return buildSequentialCodes(prefix, next, count);
}

export async function withUniqueCodeRetry(operation, maxAttempts = UNIQUE_CODE_RETRY_LIMIT) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === maxAttempts) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
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

export function getDeXuatPrefix() {
  return `CP${getYYMM()}-`;
}

export function getThuChiPrefix() {
  return `TC${getYYMM()}-`;
}
