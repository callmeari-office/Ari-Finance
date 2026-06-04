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
