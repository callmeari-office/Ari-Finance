import { describe, it, expect } from 'vitest';
import { gomConLaiTheoDanhMuc, splitSapToiHan } from './dashboardQueries';

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

describe('splitSapToiHan', () => {
  const nguong = new Date('2026-06-29T23:59:59.999');

  it('chia theo ngưỡng: <= ngưỡng là sắp tới hạn, > ngưỡng là xa', () => {
    const rows = [
      { danhMucId: 'C1', soTien: 5, ngay: new Date('2026-06-25') }, // trong cửa sổ
      { danhMucId: 'C2', soTien: 9, ngay: new Date('2026-07-02') }, // xa
    ];
    const { sapToiHanRows, conLaiXaRows } = splitSapToiHan(rows, nguong);
    expect(sapToiHanRows).toHaveLength(1);
    expect(sapToiHanRows[0].danhMucId).toBe('C1');
    expect(conLaiXaRows).toHaveLength(1);
    expect(conLaiXaRows[0].danhMucId).toBe('C2');
  });

  it('khoản quá hạn (trước hôm nay) vẫn tính là sắp tới hạn', () => {
    const rows = [{ danhMucId: 'C1', soTien: 5, ngay: new Date('2026-06-10') }];
    const { sapToiHanRows, conLaiXaRows } = splitSapToiHan(rows, nguong);
    expect(sapToiHanRows).toHaveLength(1);
    expect(conLaiXaRows).toHaveLength(0);
  });

  it('chấp nhận ngày dạng chuỗi và biên đúng bằng ngưỡng', () => {
    const rows = [{ danhMucId: 'C1', soTien: 5, ngay: '2026-06-29T00:00:00' }];
    const { sapToiHanRows } = splitSapToiHan(rows, nguong);
    expect(sapToiHanRows).toHaveLength(1);
  });

  it('mảng rỗng → 2 nhóm rỗng', () => {
    expect(splitSapToiHan([], nguong)).toEqual({ sapToiHanRows: [], conLaiXaRows: [] });
  });
});
