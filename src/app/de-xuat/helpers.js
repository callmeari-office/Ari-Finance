// src/app/de-xuat/helpers.js
// Helper THUẦN cho trang Đề xuất — tách khỏi page.js để gọn + test được.

/** Định dạng số nguyên (chuỗi chỉ-chữ-số) thành "1.500.000" để hiển thị. */
export function formatSoTienDisplay(raw) {
  if (!raw) return '';
  const num = parseInt(raw, 10);
  return isNaN(num) ? '' : num.toLocaleString('vi-VN');
}

/**
 * Chuẩn hóa 1 ô ngày từ Excel/chuỗi về 'yyyy-mm-dd' (hoặc null nếu không hợp lệ).
 * Nhận: Date object, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd.
 */
export function parseDateCell(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // yyyy-mm-dd or yy-mm-dd
  const m2 = s.match(/^(\d{2}|\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) {
    let year = m2[1];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  }
  // dd/mm/yyyy hoặc dd/mm/yy hoặc dd-mm-yy...
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Phân nhóm "duyệt nhanh hàng loạt" cho 1 phiếu ở trang Đề xuất.
 * - 'TIEN_SHOP': phiếu tiền shop chờ thanh toán HOẶC "Thanh toán sẵn" chưa gắn quỹ
 *   → duyệt qua /api/de-xuat/duyet-nhieu (mỗi phiếu 1 phiếu Chi).
 * - 'HOAN_UNG': phiếu tiền cá nhân chờ hoàn ứng → duyệt gộp qua /api/de-xuat/duyet-gop.
 * - null: không thể duyệt nhanh (đã thanh toán, lịch sử, đã hủy...).
 */
export function getProposalApproveGroup(p) {
  if (!p) return null;
  if (p.trangThai === 'CHO_HOAN_UNG') return 'HOAN_UNG';
  if (p.trangThai === 'CHO_THANH_TOAN') return 'TIEN_SHOP';
  // "Thanh toán sẵn": đã đánh dấu trả, chưa qua quỹ (DA_THANH_TOAN, không phải lịch sử, chưa gắn ThuChi)
  if (p.trangThai === 'DA_THANH_TOAN' && !p.laLichSu && p.thuChiId == null) return 'TIEN_SHOP';
  return null;
}

/**
 * Xác định tập phiếu đã chọn có duyệt nhanh hàng loạt được không.
 * Trả về { group, reason }:
 * - group 'TIEN_SHOP' | 'HOAN_UNG' khi tất cả phiếu cùng một nhóm duyệt được.
 * - group null kèm reason (lý do disable nút) khi rỗng hoặc trộn nhóm/không duyệt được.
 */
export function resolveBulkApproveGroup(selectedProps) {
  if (!selectedProps || selectedProps.length === 0) {
    return { group: null, reason: 'Chưa chọn phiếu nào.' };
  }
  const groups = new Set(selectedProps.map(getProposalApproveGroup));
  if (groups.has(null)) {
    return {
      group: null,
      reason: 'Có phiếu không thể duyệt (đã thanh toán/đã hủy). Hãy lọc theo trạng thái trước khi chọn.',
    };
  }
  if (groups.size > 1) {
    return {
      group: null,
      reason: 'Đang trộn phiếu tiền shop và hoàn ứng. Hãy lọc theo 1 nhóm trạng thái rồi chọn lại.',
    };
  }
  return { group: Array.from(groups)[0], reason: '' };
}
