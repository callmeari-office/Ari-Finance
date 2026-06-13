// Giới hạn số lần thử đăng nhập sai — lưu ở PostgreSQL để đếm xuyên instance serverless.
// Interface: checkRateLimit / recordFailure / resetRateLimit (tất cả async).
// Cửa sổ 15 phút / 5 lần / khóa 15 phút.

import { prisma } from './prisma';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

/**
 * Kiểm tra key (IP:username) còn được phép thử không.
 * @returns {{ allowed: boolean, retryAfterSec?: number, remaining?: number }}
 */
export async function checkRateLimit(key) {
  try {
    const now = Date.now();
    const rows = await prisma.$queryRaw`
      SELECT "count", "firstAt", "blockedUntil"
      FROM "LoginAttempt"
      WHERE "key" = ${key}
    `;

    if (!rows.length) return { allowed: true, remaining: MAX_ATTEMPTS };

    const count = rows[0].count;
    const firstAt = Number(rows[0].firstAt);
    const blockedUntil = Number(rows[0].blockedUntil);

    if (blockedUntil > 0 && now < blockedUntil) {
      return { allowed: false, retryAfterSec: Math.ceil((blockedUntil - now) / 1000) };
    }

    if (now - firstAt > WINDOW_MS) {
      // Cửa sổ cũ đã hết hạn — dọn dẹp và reset
      await prisma.$executeRaw`DELETE FROM "LoginAttempt" WHERE "key" = ${key}`;
      return { allowed: true, remaining: MAX_ATTEMPTS };
    }

    return { allowed: true, remaining: Math.max(0, MAX_ATTEMPTS - count) };
  } catch {
    // Fail open nếu DB không trả lời — ưu tiên availability
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
}

/**
 * Ghi nhận một lần thử THẤT BẠI (upsert nguyên tử).
 * Trả về true nếu vừa bị khóa.
 */
export async function recordFailure(key) {
  try {
    const now = Date.now();
    const nowBig = BigInt(now);
    const windowBig = BigInt(WINDOW_MS);
    const blockUntilBig = BigInt(now + BLOCK_MS);

    const rows = await prisma.$queryRaw`
      INSERT INTO "LoginAttempt" ("key", "count", "firstAt", "blockedUntil", "updatedAt")
      VALUES (${key}, 1, ${nowBig}, ${BigInt(0)}, ${nowBig})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN (${nowBig} - "LoginAttempt"."firstAt") > ${windowBig}
            THEN 1
          ELSE "LoginAttempt"."count" + 1
        END,
        "firstAt" = CASE
          WHEN (${nowBig} - "LoginAttempt"."firstAt") > ${windowBig}
            THEN ${nowBig}
          ELSE "LoginAttempt"."firstAt"
        END,
        "blockedUntil" = CASE
          WHEN (${nowBig} - "LoginAttempt"."firstAt") > ${windowBig}
            THEN ${BigInt(0)}
          WHEN ("LoginAttempt"."count" + 1) >= ${MAX_ATTEMPTS}
            THEN ${blockUntilBig}
          ELSE ${BigInt(0)}
        END,
        "updatedAt" = ${nowBig}
      RETURNING "count", "blockedUntil"
    `;

    if (!rows.length) return false;
    const blocked = Number(rows[0].blockedUntil);
    return blocked > 0 && blocked > now;
  } catch {
    return false;
  }
}

/**
 * Xóa bộ đếm khi đăng nhập THÀNH CÔNG.
 */
export async function resetRateLimit(key) {
  try {
    await prisma.$executeRaw`DELETE FROM "LoginAttempt" WHERE "key" = ${key}`;
  } catch {
    // Không critical — đăng nhập đã thành công
  }
}
