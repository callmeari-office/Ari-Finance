import { describe, it, expect } from 'vitest';
import { gomConLaiTheoDanhMuc } from './dashboardQueries';

describe('gomConLaiTheoDanhMuc', () => {
  it('gộp số tiền theo danh mục, sắp giảm dần, trả tổng', () => {
    const rows = [
      { danhMucId: 'C1', tenDanhMuc: 'Lương', soTien: 30_000_000 },
      { danhMucId: 'C2', tenDanhMuc: 'Thuê', soTien: 12_000_000 },
      { danhMucId: 'C1', tenDanhMuc: 'Lương', soTien: 5_000_000 },
    ];
    const { conLaiCoDinh, conLaiTheoDanhMuc } = gomConLaiTheoDanhMuc(rows);
    expect(conLaiCoDinh).toBe(47_000_000);
    expect(conLaiTheoDanhMuc).toEqual([
      { danhMucId: 'C1', tenDanhMuc: 'Lương', soTien: 35_000_000 },
      { danhMucId: 'C2', tenDanhMuc: 'Thuê', soTien: 12_000_000 },
    ]);
  });

  it('mảng rỗng → tổng 0, danh sách rỗng', () => {
    expect(gomConLaiTheoDanhMuc([])).toEqual({ conLaiCoDinh: 0, conLaiTheoDanhMuc: [] });
  });
});
