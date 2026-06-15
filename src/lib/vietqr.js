// src/lib/vietqr.js
// Sinh URL ảnh VietQR từ thông tin nhà cung cấp — hàm THUẦN, tách từ de-xuat/page.js
// để tái dùng + test được.

// Map mã viết tắt ngân hàng (tenNganHang phần trước dấu '-') → bank code của img.vietqr.io
const BANK_MAP = {
  vcb: 'vietcombank', tcb: 'techcombank', ctg: 'vietinbank',
  mb: 'mb', mbbank: 'mb', vpb: 'vpbank', hdb: 'hdbank',
  stb: 'sacombank', tpb: 'tpbank', msb: 'msb', shb: 'shb',
  eib: 'eximbank', ocb: 'ocb', lpb: 'lpbank', abb: 'abbank',
  nab: 'namabank', cake: 'cake',
};

/**
 * @param {{tenNganHang:string, soTaiKhoan:string, tenTaiKhoan?:string, tenNCC?:string}} vendor
 * @param {number|string} amount - số tiền
 * @param {string} memo - nội dung chuyển khoản
 * @returns {string} URL ảnh QR (rỗng nếu thiếu vendor)
 */
export function generateVietQRUrl(vendor, amount, memo) {
  if (!vendor) return '';
  const nameUpper = vendor.tenNganHang.toUpperCase();
  const bankCode = nameUpper.includes('-') ? nameUpper.split('-')[0].trim() : nameUpper.trim();
  const qrBank = BANK_MAP[bankCode.toLowerCase()] || bankCode.toLowerCase();
  const accountName = vendor.tenTaiKhoan || vendor.tenNCC;

  return `https://img.vietqr.io/image/${qrBank}-${vendor.soTaiKhoan}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(accountName)}`;
}
