// Giới hạn số lần thử (chống dò mật khẩu brute-force).
// Lưu trong RAM của server — đủ cho app nội bộ 1 instance.
// Lưu ý: nếu deploy serverless nhiều instance (vd Vercel scale), mỗi instance đếm riêng;
// khi đó nên chuyển sang lưu ở DB/Redis. Với SME <5 người, mức này là đủ.

const store = new Map(); // key -> { count, firstAt, blockedUntil }

const WINDOW_MS = 15 * 60 * 1000; // cửa sổ tính số lần thử: 15 phút
const MAX_ATTEMPTS = 5;            // tối đa 5 lần sai trong cửa sổ
const BLOCK_MS = 15 * 60 * 1000;  // khóa tạm 15 phút sau khi vượt ngưỡng

/**
 * Kiểm tra một key (vd: username + IP) còn được phép thử không.
 * @returns {{ allowed: boolean, retryAfterSec?: number, remaining?: number }}
 */
export function checkRateLimit(key) {
  const now = Date.now();
  const rec = store.get(key);

  if (!rec) return { allowed: true, remaining: MAX_ATTEMPTS };

  // Đang trong thời gian bị khóa
  if (rec.blockedUntil && now < rec.blockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.blockedUntil - now) / 1000) };
  }

  // Cửa sổ cũ đã hết hạn → reset
  if (now - rec.firstAt > WINDOW_MS) {
    store.delete(key);
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  return { allowed: true, remaining: Math.max(0, MAX_ATTEMPTS - rec.count) };
}

/**
 * Ghi nhận một lần thử THẤT BẠI. Trả về true nếu vừa bị khóa.
 */
export function recordFailure(key) {
  const now = Date.now();
  const rec = store.get(key);

  if (!rec || now - rec.firstAt > WINDOW_MS) {
    store.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return false;
  }

  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.blockedUntil = now + BLOCK_MS;
  }
  store.set(key, rec);
  return rec.count >= MAX_ATTEMPTS;
}

/**
 * Xóa bộ đếm khi đăng nhập THÀNH CÔNG.
 */
export function resetRateLimit(key) {
  store.delete(key);
}

// Dọn rác định kỳ để Map không phình mãi (chạy 1 lần khi module nạp).
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of store.entries()) {
      const expired = now - rec.firstAt > WINDOW_MS && (!rec.blockedUntil || now > rec.blockedUntil);
      if (expired) store.delete(key);
    }
  }, WINDOW_MS);
  // Không giữ tiến trình sống chỉ vì timer này.
  if (timer.unref) timer.unref();
}
