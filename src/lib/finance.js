// src/lib/finance.js
// Hàm tính toán tiền tệ THUẦN (không đụng DB) — dùng chung & test được.
// Tách ra để tránh lặp công thức ở nhiều nơi (getFunds, getDuBao, cron) và để
// có unit test bảo vệ logic tiền — sai công thức ở đây = sai tiền toàn app.

/** Ép về số an toàn: null/undefined/NaN/chuỗi rác → 0. */
export function toSoTien(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Chuẩn hóa số tiền NGƯỜI DÙNG NHẬP về VND nguyên (làm tròn, bỏ phần lẻ).
 * Dùng tại các điểm ghi DB do người dùng nhập tay (đề xuất, thu-chi, quỹ, kế hoạch,
 * doanh thu) để không bao giờ có VND lẻ lọt vào DB. Giá trị rác → 0.
 */
export function lamTronTien(v) {
  return Math.round(toSoTien(v));
}

/**
 * NGUỒN SỰ THẬT DUY NHẤT cho số dư hiện tại của một quỹ.
 *   soDuHienTai = soDuDauKy + tongThu − tongChi + soDuDieuChinh
 *
 * Mọi nơi cần số dư quỹ phải gọi hàm này (đừng viết lại công thức tay).
 * Ngoại lệ có chủ ý: /api/quy/[id]/dieu-chinh tính số dư "tự nhiên" (KHÔNG cộng
 * soDuDieuChinh) để suy ra mức điều chỉnh — chỗ đó cố tình không dùng hàm này.
 *
 * @param {{soDuDauKy?:number, tongThu?:number, tongChi?:number, soDuDieuChinh?:number}} p
 * @returns {number}
 */
export function tinhSoDuQuy({ soDuDauKy, tongThu, tongChi, soDuDieuChinh } = {}) {
  return toSoTien(soDuDauKy) + toSoTien(tongThu) - toSoTien(tongChi) + toSoTien(soDuDieuChinh);
}

/**
 * Phần trăm đạt được, làm tròn về số nguyên. Chia 0 → 0 (không trả Infinity/NaN).
 * Dùng cho "đạt X% chỉ tiêu", "đã chi X% hạn mức"...
 */
export function phanTramDat(thucTe, chiTieu) {
  const ct = toSoTien(chiTieu);
  if (ct <= 0) return 0;
  return Math.round((toSoTien(thucTe) / ct) * 100);
}
