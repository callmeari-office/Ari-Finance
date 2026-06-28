import { describe, it, expect } from 'vitest';
import { parseDateCell, getProposalApproveGroup, resolveBulkApproveGroup } from './helpers';

describe('parseDateCell', () => {
  it('định dạng dd/mm/yyyy chuẩn', () => {
    expect(parseDateCell('08/06/2026')).toBe('2026-06-08');
    expect(parseDateCell('8/6/2026')).toBe('2026-06-08');
    expect(parseDateCell('31/12/2025')).toBe('2025-12-31');
  });

  it('định dạng dd/mm/yy (năm 2 chữ số)', () => {
    expect(parseDateCell('8/6/26')).toBe('2026-06-08');
    expect(parseDateCell('08/06/26')).toBe('2026-06-08');
    expect(parseDateCell('31/12/25')).toBe('2025-12-31');
  });

  it('định dạng dd-mm-yyyy hoặc dd.mm.yyyy', () => {
    expect(parseDateCell('08-06-2026')).toBe('2026-06-08');
    expect(parseDateCell('08.06.2026')).toBe('2026-06-08');
    expect(parseDateCell('8-6-26')).toBe('2026-06-08');
  });

  it('định dạng yyyy-mm-dd', () => {
    expect(parseDateCell('2026-06-08')).toBe('2026-06-08');
    expect(parseDateCell('2025-12-31')).toBe('2025-12-31');
  });

  it('định dạng yy-mm-dd (năm 2 chữ số)', () => {
    expect(parseDateCell('26-06-08')).toBe('2026-06-08');
  });

  it('định dạng Date object', () => {
    const d = new Date(2026, 5, 8); // June 8, 2026
    expect(parseDateCell(d)).toBe('2026-06-08');
  });

  it('giá trị không hợp lệ → null', () => {
    expect(parseDateCell(null)).toBeNull();
    expect(parseDateCell(undefined)).toBeNull();
    expect(parseDateCell('')).toBeNull();
    expect(parseDateCell('invalid-date')).toBeNull();
    expect(parseDateCell('8/6')).toBeNull(); // thiếu năm
  });
});

describe('getProposalApproveGroup', () => {
  it('phiếu chờ thanh toán (tiền shop) → TIEN_SHOP', () => {
    expect(getProposalApproveGroup({ trangThai: 'CHO_THANH_TOAN' })).toBe('TIEN_SHOP');
  });

  it('phiếu "Thanh toán sẵn" (chưa gắn quỹ, không lịch sử) → TIEN_SHOP', () => {
    expect(getProposalApproveGroup({ trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: null })).toBe('TIEN_SHOP');
  });

  it('phiếu chờ hoàn ứng (tiền cá nhân) → HOAN_UNG', () => {
    expect(getProposalApproveGroup({ trangThai: 'CHO_HOAN_UNG' })).toBe('HOAN_UNG');
  });

  it('phiếu đã thanh toán qua quỹ → null', () => {
    expect(getProposalApproveGroup({ trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: 'tc1' })).toBeNull();
  });

  it('phiếu lịch sử → null', () => {
    expect(getProposalApproveGroup({ trangThai: 'DA_THANH_TOAN', laLichSu: true, thuChiId: null })).toBeNull();
  });

  it('phiếu đã hủy → null; phiếu rỗng → null', () => {
    expect(getProposalApproveGroup({ trangThai: 'HUY' })).toBeNull();
    expect(getProposalApproveGroup(null)).toBeNull();
  });
});

describe('resolveBulkApproveGroup', () => {
  it('rỗng → null kèm lý do', () => {
    const r = resolveBulkApproveGroup([]);
    expect(r.group).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it('toàn phiếu tiền shop (gồm "Thanh toán sẵn") → TIEN_SHOP', () => {
    const r = resolveBulkApproveGroup([
      { trangThai: 'CHO_THANH_TOAN' },
      { trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: null },
    ]);
    expect(r.group).toBe('TIEN_SHOP');
    expect(r.reason).toBe('');
  });

  it('toàn phiếu hoàn ứng → HOAN_UNG', () => {
    const r = resolveBulkApproveGroup([
      { trangThai: 'CHO_HOAN_UNG' },
      { trangThai: 'CHO_HOAN_UNG' },
    ]);
    expect(r.group).toBe('HOAN_UNG');
  });

  it('trộn tiền shop + hoàn ứng → null kèm lý do', () => {
    const r = resolveBulkApproveGroup([
      { trangThai: 'CHO_THANH_TOAN' },
      { trangThai: 'CHO_HOAN_UNG' },
    ]);
    expect(r.group).toBeNull();
    expect(r.reason).toMatch(/trộn/i);
  });

  it('có phiếu không duyệt được → null kèm lý do', () => {
    const r = resolveBulkApproveGroup([
      { trangThai: 'CHO_THANH_TOAN' },
      { trangThai: 'DA_THANH_TOAN', laLichSu: false, thuChiId: 'tc1' },
    ]);
    expect(r.group).toBeNull();
    expect(r.reason).toBeTruthy();
  });
});
