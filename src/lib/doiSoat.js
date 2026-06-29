// src/lib/doiSoat.js
// Hàm thuần tính đối soát doanh thu — không đụng DB, test được.

/** Tính trung vị (median) của mảng số. Trả null nếu mảng rỗng. */
function tinhMedian(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Bổ sung chenhLech và tyLe vào mỗi tháng.
 * @param {Array<{thang, doanhThuKhaiBao, tienThucNhan, ghiChu}>} months
 * @returns mảng cùng số phần tử, mỗi phần tử kèm chenhLech + tyLe.
 */
export function tinhDoiSoat(months) {
  return months.map((m) => {
    const dtKB = Number(m.doanhThuKhaiBao || 0);
    const ttn = Number(m.tienThucNhan || 0);
    const chenhLech = dtKB - ttn;
    const tyLe = dtKB > 0 ? Math.round((ttn / dtKB) * 100) : null;
    return { ...m, chenhLech, tyLe };
  });
}

/**
 * Phát hiện tháng bất thường dựa trên trung vị tỷ lệ.
 * Chỉ xét tháng có doanhThuKhaiBao > 0 (tyLe !== null).
 * Cần >= 3 tháng đủ dữ liệu — ít hơn thì không đánh cờ.
 *
 * @param {Array} rows  - Kết quả từ tinhDoiSoat
 * @param {{nguong?: number}} options  - nguong mặc định 15 (%)
 * @returns {{ rows: Array, trungViTyLe: number|null }}
 */
export function phatHienBatThuong(rows, { nguong = 15 } = {}) {
  const valid = rows.filter((r) => r.tyLe !== null && Number(r.doanhThuKhaiBao || 0) > 0);

  if (valid.length < 3) {
    return {
      rows: rows.map((r) => ({ ...r, batThuong: false })),
      trungViTyLe: null,
    };
  }

  const trungViTyLe = tinhMedian(valid.map((r) => r.tyLe));
  const nguongDuoi = trungViTyLe - nguong;

  return {
    rows: rows.map((r) => ({
      ...r,
      batThuong:
        r.tyLe !== null &&
        Number(r.doanhThuKhaiBao || 0) > 0 &&
        r.tyLe < nguongDuoi,
    })),
    trungViTyLe,
  };
}
