/**
 * Tiện ích vai trò dùng chung cho cả server (API routes) lẫn client (page.js).
 * KHÔNG import gì từ next/headers hay prisma để có thể dùng được ở client component.
 *
 * Bối cảnh: vai trò LEADER (Trưởng nhóm) hiện được tạo để "chuẩn bị sẵn" và
 * kế thừa toàn bộ hành vi/quyền của STAFF. Dữ liệu danh mục (chucVuDuocXem) chỉ
 * liệt kê tới STAFF, nên LEADER cần được coi như STAFF khi đối chiếu quyền xem
 * danh mục. Sau này nếu muốn LEADER khác STAFF, chỉ cần sửa các hàm dưới đây
 * (hoặc dùng trang Quản lý Quyền cho phần ẩn/hiện menu).
 */

/**
 * Trả về danh sách "token vai trò" dùng để so khớp với mảng chucVuDuocXem của
 * danh mục. LEADER khớp cả với các danh mục cấu hình cho STAFF.
 */
export function getEffectiveRoles(role) {
  if (role === 'LEADER') return ['LEADER', 'STAFF'];
  return [role];
}

/**
 * Vai trò này có được phép xem một danh mục (theo mảng chucVuDuocXem) không?
 */
export function canViewCategory(role, allowedRoles) {
  if (!Array.isArray(allowedRoles)) return false;
  return getEffectiveRoles(role).some((r) => allowedRoles.includes(r));
}

/**
 * Vai trò chỉ được xem/sửa đề xuất do chính mình tạo (như STAFF). LEADER cũng vậy.
 */
export function isRestrictedToOwnProposals(role) {
  return role === 'STAFF' || role === 'LEADER';
}

/**
 * Vai trò có được xem một Nhà cung cấp không, theo danh sách vai trò được phép.
 * - OWNER: luôn xem được.
 * - allowedRoles là null / không phải mảng / mảng rỗng: mọi vai trò xem được
 *   (mặc định cho dữ liệu cũ + NCC tạo nhanh).
 * - Ngược lại: chỉ vai trò nằm trong danh sách (LEADER khớp như STAFF).
 */
export function canViewNcc(role, allowedRoles) {
  if (role === 'OWNER') return true;
  // null / không phải mảng = mặc định mọi vai trò xem được.
  // Mảng (kể cả rỗng) = giới hạn rõ ràng → chỉ vai trò trong danh sách (rỗng = chỉ Owner).
  if (!Array.isArray(allowedRoles)) return true;
  return getEffectiveRoles(role).some((r) => allowedRoles.includes(r));
}

/** Parse an toàn chuỗi JSON chucVuDuocXem → mảng vai trò hoặc null. */
export function parseChucVuDuocXem(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

/**
 * NGUỒN SỰ THẬT DUY NHẤT cho quyền hiển thị menu / tính năng theo vai trò mặc định.
 * Dùng chung bởi Sidebar (lọc menu), trang Quản lý Quyền (khởi tạo toggle) và các
 * page guard. Trang /quyen có thể override từng key cho từng vai trò (lưu vào
 * VaiTroQuyen.permissions). OWNER luôn full quyền nên không phụ thuộc bảng này.
 *
 * Ngoài các menu cấp 1, còn có "key con" để phân quyền tinh hơn trong 1 trang:
 *  - doanhThuDBThang / doanhThuDBNam: tab Dashboard Tháng / Năm trong Kế hoạch doanh thu
 *    (chỉ có tác dụng khi đã được xem `doanhThu`).
 *  - keHoachDBThang / keHoachDBNam: tab Dashboard Tháng / Năm trong Kế hoạch chi phí
 *    (chỉ có tác dụng khi đã được xem `keHoach`).
 *
 * Riêng trang Tổng quan (Dashboard) còn có các "widget con" tq*  để bật/tắt từng
 * khối thông tin theo vai trò (chỉ có tác dụng khi đã được xem `tongQuan`):
 *  - tqKPITaiChinh: 4 thẻ KPI Doanh thu / Chi phí / Lãi-Lỗ / Tiền đang có.
 *  - tqCanXuLy:     khối "Cần xử lý" (chờ duyệt + nhắc hạn + vượt kế hoạch).
 *  - tqQuy:         bảng số dư các quỹ (realtime).
 *  - tqXuHuong:     biểu đồ Thu-Chi + đường Lãi/Lỗ 6 tháng.
 *  - tqDeXuatCuaToi: 4 thẻ thống kê đề xuất cá nhân (dành cho LEADER/STAFF).
 */
export const DEFAULT_MENU_ROLES = {
  tongQuan:        ['OWNER', 'MANAGER', 'LEADER', 'STAFF'],
  tqKPITaiChinh:   ['OWNER', 'MANAGER'],
  tqCanXuLy:       ['OWNER', 'MANAGER'],
  tqQuy:           ['OWNER', 'MANAGER'],
  tqXuHuong:       ['OWNER', 'MANAGER'],
  tqDeXuatCuaToi:  ['LEADER', 'STAFF'],
  tqDuBao:         ['OWNER', 'MANAGER'],
  deXuat:          ['OWNER', 'MANAGER', 'LEADER', 'STAFF'],
  duyet:           ['OWNER'],
  thuChi:          ['OWNER', 'MANAGER'],
  quy:             ['OWNER', 'MANAGER'],
  keHoach:         ['OWNER', 'MANAGER'],
  keHoachDBThang:  ['OWNER', 'MANAGER', 'LEADER', 'STAFF'],
  keHoachDBNam:    ['OWNER', 'MANAGER', 'LEADER', 'STAFF'],
  doanhThu:        ['OWNER', 'MANAGER'],
  doanhThuDBThang: ['OWNER', 'MANAGER', 'LEADER', 'STAFF'],
  doanhThuDBNam:   ['OWNER', 'MANAGER', 'LEADER', 'STAFF'],
  loiNhuan:        ['OWNER', 'MANAGER'],
  baoCao:          ['OWNER', 'MANAGER'],
  dinhKy:          ['OWNER', 'MANAGER'],
  nhanSu:          ['OWNER'],
  ncc:             ['OWNER', 'MANAGER', 'LEADER', 'STAFF'],
  quyen:           ['OWNER'],
  cauHinh:         ['OWNER'],
  nhatKy:          ['OWNER'],
  huongDan:        ['OWNER', 'MANAGER', 'LEADER', 'STAFF'],
};

/**
 * Vai trò mặc định (chưa override) của một key — dùng để khởi tạo toggle ở /quyen
 * và làm fallback cho canViewMenu.
 */
export function defaultMenuAllowed(role, key) {
  if (role === 'OWNER') return true;
  const def = DEFAULT_MENU_ROLES[key];
  return Array.isArray(def) ? def.includes(role) : false;
}

/**
 * Người dùng (kèm `permissions` lấy từ /api/auth/me) có được xem menu/tính năng `key`?
 * Thứ tự ưu tiên: OWNER full → permissions override (nếu có key) → mặc định theo vai trò.
 * Tương thích cấu trúc cũ `{ xem: boolean }`.
 */
export function canViewMenu(user, key) {
  if (!user) return false;
  if (user.role === 'OWNER') return true;
  const perms = user.permissions;
  if (perms && typeof perms[key] !== 'undefined') {
    const v = perms[key];
    if (typeof v === 'boolean') return v;
    if (v && typeof v.xem === 'boolean') return v.xem;
  }
  return defaultMenuAllowed(user.role, key);
}
