// Đọc số tiền (VND) thành chữ tiếng Việt — giúp người dùng kiểm tra nhanh
// số 0 thừa/thiếu khi nhập tiền. Thuần JS, không phụ thuộc gì, dùng được
// cả client lẫn server.

const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const HANG = ['', 'nghìn', 'triệu', 'tỷ'];

// Đọc 1 khối 3 chữ số (0–999). `dayDu` = true khi đây không phải khối đầu tiên
// (cần đọc đủ "không trăm", "lẻ"...).
function docKhoiBaChuSo(tram, chuc, donVi, dayDu) {
  let s = '';

  if (tram > 0) {
    s += CHU_SO[tram] + ' trăm';
    if (chuc === 0 && donVi > 0) s += ' lẻ';
  } else if (dayDu && (chuc > 0 || donVi > 0)) {
    s += 'không trăm';
    if (chuc === 0 && donVi > 0) s += ' lẻ';
  }

  if (chuc > 1) {
    s += ' ' + CHU_SO[chuc] + ' mươi';
    if (donVi === 1) s += ' mốt';
    else if (donVi === 5) s += ' lăm';
    else if (donVi > 0) s += ' ' + CHU_SO[donVi];
  } else if (chuc === 1) {
    s += ' mười';
    if (donVi === 1) s += ' một';
    else if (donVi === 5) s += ' lăm';
    else if (donVi > 0) s += ' ' + CHU_SO[donVi];
  } else if (donVi > 0) {
    // chuc === 0
    s += ' ' + CHU_SO[donVi];
  }

  return s.trim();
}

/**
 * Đọc số nguyên không âm thành chữ tiếng Việt.
 * @param {number|string} input
 * @returns {string} ví dụ "một triệu hai trăm ba mươi tư nghìn"
 */
export function docSo(input) {
  let n = typeof input === 'string' ? Number(input.replace(/\D/g, '')) : Number(input);
  if (!Number.isFinite(n) || n < 0) return '';
  n = Math.floor(n);
  if (n === 0) return 'không';

  // Tách thành các khối 3 chữ số từ phải sang trái
  const khoi = [];
  while (n > 0) {
    khoi.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const parts = [];
  for (let i = khoi.length - 1; i >= 0; i--) {
    const block = khoi[i];
    if (block === 0) continue;
    const tram = Math.floor(block / 100);
    const chuc = Math.floor((block % 100) / 10);
    const donVi = block % 10;
    const dayDu = i < khoi.length - 1; // không phải khối cao nhất
    const chu = docKhoiBaChuSo(tram, chuc, donVi, dayDu);
    parts.push((chu + ' ' + HANG[i]).trim());
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Đọc số tiền VND thành chữ, viết hoa chữ đầu + hậu tố "đồng".
 * @param {number|string} input
 * @returns {string} ví dụ "Một triệu hai trăm ba mươi tư nghìn đồng"
 */
export function docSoTienVND(input) {
  const n = typeof input === 'string' ? Number(input.replace(/\D/g, '')) : Number(input);
  if (!Number.isFinite(n) || n <= 0) return '';
  const chu = docSo(n);
  if (!chu) return '';
  return chu.charAt(0).toUpperCase() + chu.slice(1) + ' đồng';
}

export default docSoTienVND;
