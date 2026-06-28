import { describe, expect, it } from 'vitest';
import { buildProposalDateWhere, buildProposalStatusWhere } from './filters';

describe('buildProposalStatusWhere', () => {
  it('returns null when no status is selected', () => {
    expect(buildProposalStatusWhere('')).toBeNull();
    expect(buildProposalStatusWhere(null)).toBeNull();
  });

  it('maps THANH_TOAN_SAN to unpaid pre-paid proposals', () => {
    expect(buildProposalStatusWhere('THANH_TOAN_SAN')).toEqual({
      trangThai: 'DA_THANH_TOAN',
      laLichSu: false,
      thuChiId: null,
    });
  });

  it('maps DA_THANH_TOAN to fully paid or historical proposals', () => {
    expect(buildProposalStatusWhere('DA_THANH_TOAN')).toEqual({
      trangThai: 'DA_THANH_TOAN',
      OR: [{ laLichSu: true }, { thuChiId: { not: null } }],
    });
  });

  it('supports selecting multiple statuses together', () => {
    expect(buildProposalStatusWhere('CHO_THANH_TOAN,THANH_TOAN_SAN')).toEqual({
      OR: [
        { trangThai: 'CHO_THANH_TOAN' },
        {
          trangThai: 'DA_THANH_TOAN',
          laLichSu: false,
          thuChiId: null,
        },
      ],
    });
  });
});

describe('buildProposalDateWhere', () => {
  it('returns null when no year is selected', () => {
    expect(buildProposalDateWhere('', '')).toBeNull();
  });

  it('builds a full-year range for one selected year', () => {
    expect(buildProposalDateWhere('2026', '')).toEqual({
      ngayPhatSinh: {
        gte: new Date(Date.UTC(2026, 0, 1)),
        lt: new Date(Date.UTC(2027, 0, 1)),
      },
    });
  });

  it('builds OR ranges for many selected years', () => {
    expect(buildProposalDateWhere('2025,2026', '')).toEqual({
      OR: [
        {
          ngayPhatSinh: {
            gte: new Date(Date.UTC(2025, 0, 1)),
            lt: new Date(Date.UTC(2026, 0, 1)),
          },
        },
        {
          ngayPhatSinh: {
            gte: new Date(Date.UTC(2026, 0, 1)),
            lt: new Date(Date.UTC(2027, 0, 1)),
          },
        },
      ],
    });
  });

  it('builds OR ranges for many months across many years', () => {
    expect(buildProposalDateWhere('2025,2026', '5,6')).toEqual({
      OR: [
        {
          ngayPhatSinh: {
            gte: new Date(Date.UTC(2025, 4, 1)),
            lt: new Date(Date.UTC(2025, 5, 1)),
          },
        },
        {
          ngayPhatSinh: {
            gte: new Date(Date.UTC(2025, 5, 1)),
            lt: new Date(Date.UTC(2025, 6, 1)),
          },
        },
        {
          ngayPhatSinh: {
            gte: new Date(Date.UTC(2026, 4, 1)),
            lt: new Date(Date.UTC(2026, 5, 1)),
          },
        },
        {
          ngayPhatSinh: {
            gte: new Date(Date.UTC(2026, 5, 1)),
            lt: new Date(Date.UTC(2026, 6, 1)),
          },
        },
      ],
    });
  });
});
