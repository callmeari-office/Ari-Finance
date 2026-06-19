const ADMIN_ROLES = ['OWNER', 'MANAGER'];

export const VALID_NGUON_TIEN = ['TIEN_SHOP', 'TIEN_CA_NHAN'];
export const VALID_TRANG_THAI_DE_XUAT = ['CHO_THANH_TOAN', 'CHO_HOAN_UNG', 'DA_THANH_TOAN'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function deriveProposalStatus(nguonTien) {
  return nguonTien === 'TIEN_CA_NHAN' ? 'CHO_HOAN_UNG' : 'CHO_THANH_TOAN';
}

export function resolveCreateProposalStatus({ role, nguonTien, requestedTrangThai }) {
  if (!isAdminRole(role)) {
    return deriveProposalStatus(nguonTien);
  }

  if (nguonTien === 'TIEN_CA_NHAN') {
    return 'CHO_HOAN_UNG';
  }

  return requestedTrangThai === 'DA_THANH_TOAN' ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN';
}

export function resolveEditProposalStatus({ role, existingProposal, requestedTrangThai, nextNguonTien }) {
  if (existingProposal?.thuChiId) {
    return undefined;
  }

  if (!isAdminRole(role)) {
    if (nextNguonTien && nextNguonTien !== existingProposal?.nguonTien) {
      return deriveProposalStatus(nextNguonTien);
    }
    return undefined;
  }

  if (!requestedTrangThai) {
    if (nextNguonTien && nextNguonTien !== existingProposal?.nguonTien) {
      return deriveProposalStatus(nextNguonTien);
    }
    return undefined;
  }

  const effectiveNguonTien = nextNguonTien || existingProposal?.nguonTien;
  return resolveCreateProposalStatus({ role, nguonTien: effectiveNguonTien, requestedTrangThai });
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
