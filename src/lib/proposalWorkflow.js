const ADMIN_ROLES = ['OWNER', 'MANAGER'];

export const VALID_NGUON_TIEN = ['TIEN_SHOP', 'TIEN_CA_NHAN'];
export const VALID_TRANG_THAI_DE_XUAT = ['CHO_THANH_TOAN', 'CHO_HOAN_UNG', 'DA_THANH_TOAN'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function deriveProposalStatus(nguonTien) {
  return nguonTien === 'TIEN_CA_NHAN' ? 'CHO_HOAN_UNG' : 'CHO_THANH_TOAN';
}

// Trạng thái khi TẠO phiếu — áp dụng cho MỌI vai trò.
// Nghiệp vụ: NV cũng có thể đã lấy tiền shop chi rồi nên được phép đánh dấu
// "Shop đã trả rồi" (DA_THANH_TOAN). Phiếu vẫn ở dạng "Thanh toán sẵn (chờ gán quỹ)"
// cho tới khi Owner gán quỹ ở bước Duyệt → mới sinh Thu-Chi & trừ quỹ.
export function resolveCreateProposalStatus({ nguonTien, requestedTrangThai }) {
  if (nguonTien === 'TIEN_CA_NHAN') {
    return 'CHO_HOAN_UNG';
  }

  return requestedTrangThai === 'DA_THANH_TOAN' ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN';
}

// Trạng thái khi SỬA phiếu — cũng role-agnostic (nhất quán với create).
// Vẫn giữ khóa: phiếu đã gán Thu-Chi (thuChiId) thì không đổi trạng thái.
export function resolveEditProposalStatus({ existingProposal, requestedTrangThai, nextNguonTien }) {
  if (existingProposal?.thuChiId) {
    return undefined;
  }

  if (!requestedTrangThai) {
    if (nextNguonTien && nextNguonTien !== existingProposal?.nguonTien) {
      return deriveProposalStatus(nextNguonTien);
    }
    return undefined;
  }

  const effectiveNguonTien = nextNguonTien || existingProposal?.nguonTien;
  return resolveCreateProposalStatus({ nguonTien: effectiveNguonTien, requestedTrangThai });
}

export function getApprovableProposalError(proposal) {
  if (!proposal) return 'Khong tim thay de xuat.';
  if (proposal.laLichSu) return 'Phieu lich su khong duoc duyet thanh toan.';
  if (proposal.thuChiId) return 'De xuat da thanh toan va gan dong tien.';
  if (proposal.trangThai === 'HUY') return 'De xuat da huy, khong the duyet.';
  if (
    proposal.trangThai !== 'CHO_THANH_TOAN' &&
    proposal.trangThai !== 'DA_THANH_TOAN'
  ) {
    return 'Trang thai de xuat khong the duyet thanh toan.';
  }
  return null;
}
