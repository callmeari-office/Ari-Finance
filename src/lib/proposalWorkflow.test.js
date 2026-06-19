import { describe, expect, it } from 'vitest';
import {
  deriveProposalStatus,
  getApprovableProposalError,
  resolveCreateProposalStatus,
  resolveEditProposalStatus,
} from './proposalWorkflow';

describe('deriveProposalStatus', () => {
  it('derives pending payment for shop money and pending reimbursement for personal advance', () => {
    expect(deriveProposalStatus('TIEN_SHOP')).toBe('CHO_THANH_TOAN');
    expect(deriveProposalStatus('TIEN_CA_NHAN')).toBe('CHO_HOAN_UNG');
  });
});

describe('resolveCreateProposalStatus', () => {
  it('prevents staff/leader from client-controlling paid status', () => {
    expect(resolveCreateProposalStatus({
      role: 'STAFF',
      nguonTien: 'TIEN_SHOP',
      requestedTrangThai: 'DA_THANH_TOAN',
    })).toBe('CHO_THANH_TOAN');

    expect(resolveCreateProposalStatus({
      role: 'LEADER',
      nguonTien: 'TIEN_CA_NHAN',
      requestedTrangThai: 'DA_THANH_TOAN',
    })).toBe('CHO_HOAN_UNG');
  });

  it('allows owner/manager to create the explicit prepaid shop-money state', () => {
    expect(resolveCreateProposalStatus({
      role: 'OWNER',
      nguonTien: 'TIEN_SHOP',
      requestedTrangThai: 'DA_THANH_TOAN',
    })).toBe('DA_THANH_TOAN');
  });
});

describe('resolveEditProposalStatus', () => {
  it('ignores staff attempts to edit a proposal into paid status', () => {
    expect(resolveEditProposalStatus({
      role: 'STAFF',
      existingProposal: { trangThai: 'CHO_THANH_TOAN', thuChiId: null, nguonTien: 'TIEN_SHOP' },
      requestedTrangThai: 'DA_THANH_TOAN',
      nextNguonTien: 'TIEN_SHOP',
    })).toBeUndefined();
  });

  it('re-derives status when staff changes the money source', () => {
    expect(resolveEditProposalStatus({
      role: 'STAFF',
      existingProposal: { trangThai: 'CHO_THANH_TOAN', thuChiId: null, nguonTien: 'TIEN_SHOP' },
      nextNguonTien: 'TIEN_CA_NHAN',
    })).toBe('CHO_HOAN_UNG');
  });
});

describe('getApprovableProposalError', () => {
  it('rejects canceled, historical, or already-linked proposals', () => {
    expect(getApprovableProposalError({ trangThai: 'HUY', laLichSu: false, thuChiId: null })).toMatch(/huy/i);
    expect(getApprovableProposalError({ trangThai: 'CHO_THANH_TOAN', laLichSu: true, thuChiId: null })).toMatch(/lich su/i);
    expect(getApprovableProposalError({ trangThai: 'CHO_THANH_TOAN', laLichSu: false, thuChiId: 'TC1' })).toMatch(/thanh toan/i);
  });

  it('allows only pending payment and explicit prepaid pending-fund proposals', () => {
    expect(getApprovableProposalError({ trangThai: 'CHO_THANH_TOAN', laLichSu: false, thuChiId: null })).toBeNull();
    expect(getApprovableProposalError({ trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: null })).toBeNull();
    expect(getApprovableProposalError({ trangThai: 'CHO_HOAN_UNG', laLichSu: false, thuChiId: null })).toMatch(/trang thai/i);
  });
});
