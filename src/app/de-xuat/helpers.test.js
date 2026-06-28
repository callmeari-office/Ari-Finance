import { describe, expect, it } from 'vitest';
import {
  formatSoTienDisplay,
  parseDateCell,
  getProposalApproveGroup,
  resolveBulkApproveGroup,
  getProposalStatusMeta,
} from './helpers';

describe('formatSoTienDisplay', () => {
  it('formats integer strings for display', () => {
    expect(formatSoTienDisplay('1500000')).toBe('1.500.000');
    expect(formatSoTienDisplay('0')).toBe('0');
  });
});

describe('parseDateCell', () => {
  it('parses dd/mm/yyyy', () => {
    expect(parseDateCell('08/06/2026')).toBe('2026-06-08');
    expect(parseDateCell('8/6/2026')).toBe('2026-06-08');
    expect(parseDateCell('31/12/2025')).toBe('2025-12-31');
  });

  it('parses dd/mm/yy', () => {
    expect(parseDateCell('8/6/26')).toBe('2026-06-08');
    expect(parseDateCell('08/06/26')).toBe('2026-06-08');
    expect(parseDateCell('31/12/25')).toBe('2025-12-31');
  });

  it('parses dd-mm-yyyy and dd.mm.yyyy', () => {
    expect(parseDateCell('08-06-2026')).toBe('2026-06-08');
    expect(parseDateCell('08.06.2026')).toBe('2026-06-08');
    expect(parseDateCell('8-6-26')).toBe('2026-06-08');
  });

  it('parses yyyy-mm-dd', () => {
    expect(parseDateCell('2026-06-08')).toBe('2026-06-08');
    expect(parseDateCell('2025-12-31')).toBe('2025-12-31');
  });

  it('parses yy-mm-dd', () => {
    expect(parseDateCell('26-06-08')).toBe('2026-06-08');
  });

  it('parses Date objects', () => {
    const d = new Date(2026, 5, 8);
    expect(parseDateCell(d)).toBe('2026-06-08');
  });

  it('returns null for invalid values', () => {
    expect(parseDateCell(null)).toBeNull();
    expect(parseDateCell(undefined)).toBeNull();
    expect(parseDateCell('')).toBeNull();
    expect(parseDateCell('invalid-date')).toBeNull();
    expect(parseDateCell('8/6')).toBeNull();
  });
});

describe('getProposalApproveGroup', () => {
  it('maps cho thanh toan to TIEN_SHOP', () => {
    expect(getProposalApproveGroup({ trangThai: 'CHO_THANH_TOAN' })).toBe('TIEN_SHOP');
  });

  it('maps thanh toan san to TIEN_SHOP', () => {
    expect(getProposalApproveGroup({ trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: null })).toBe('TIEN_SHOP');
  });

  it('maps cho hoan ung to HOAN_UNG', () => {
    expect(getProposalApproveGroup({ trangThai: 'CHO_HOAN_UNG' })).toBe('HOAN_UNG');
  });

  it('returns null for already-paid proposals', () => {
    expect(getProposalApproveGroup({ trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: 'tc1' })).toBeNull();
  });

  it('returns null for historical proposals', () => {
    expect(getProposalApproveGroup({ trangThai: 'DA_THANH_TOAN', laLichSu: true, thuChiId: null })).toBeNull();
  });

  it('returns null for cancelled or empty proposals', () => {
    expect(getProposalApproveGroup({ trangThai: 'HUY' })).toBeNull();
    expect(getProposalApproveGroup(null)).toBeNull();
  });
});

describe('resolveBulkApproveGroup', () => {
  it('returns null with reason for empty selection', () => {
    const r = resolveBulkApproveGroup([]);
    expect(r.group).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it('allows mixed shop-payment states in one group', () => {
    const r = resolveBulkApproveGroup([
      { trangThai: 'CHO_THANH_TOAN' },
      { trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: null },
    ]);
    expect(r.group).toBe('TIEN_SHOP');
    expect(r.reason).toBe('');
  });

  it('allows reimburse-only selection', () => {
    const r = resolveBulkApproveGroup([
      { trangThai: 'CHO_HOAN_UNG' },
      { trangThai: 'CHO_HOAN_UNG' },
    ]);
    expect(r.group).toBe('HOAN_UNG');
  });

  it('returns null with reason when groups are mixed', () => {
    const r = resolveBulkApproveGroup([
      { trangThai: 'CHO_THANH_TOAN' },
      { trangThai: 'CHO_HOAN_UNG' },
    ]);
    expect(r.group).toBeNull();
    expect(r.reason).toMatch(/tron/i);
  });

  it('returns null with reason for non-approvable items', () => {
    const r = resolveBulkApproveGroup([
      { trangThai: 'CHO_THANH_TOAN' },
      { trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: 'tc1' },
    ]);
    expect(r.group).toBeNull();
    expect(r.reason).toBeTruthy();
  });
});

describe('getProposalStatusMeta', () => {
  it('distinguishes prepaid from fully paid proposals', () => {
    expect(
      getProposalStatusMeta({ trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: null })
    ).toEqual({
      label: 'Thanh toan san',
      tone: 'prepaid',
      icon: 'sparkles',
    });

    expect(
      getProposalStatusMeta({ trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: 'TC001' })
    ).toEqual({
      label: 'Da thanh toan',
      tone: 'paid',
      icon: 'check',
    });
  });

  it('keeps reimburse visually separate', () => {
    expect(getProposalStatusMeta({ trangThai: 'CHO_HOAN_UNG' })).toEqual({
      label: 'Cho hoan ung',
      tone: 'reimburse',
      icon: 'hand-coins',
    });
  });

  it('supports compact historical labels', () => {
    expect(
      getProposalStatusMeta({ trangThai: 'DA_THANH_TOAN', laLichSu: true, thuChiId: null }, { compact: true })
    ).toEqual({
      label: 'Lich su',
      tone: 'history',
      icon: 'archive',
    });
  });
});
