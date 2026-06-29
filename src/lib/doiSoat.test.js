import { describe, it, expect } from 'vitest';
import { tinhDoiSoat, phatHienBatThuong } from './doiSoat';

// Tạo mảng 12 tháng, ghi đè tháng 1 (index 0) bằng overrides[0], v.v.
function makeMonths(overrides = []) {
  return Array.from({ length: 12 }, (_, i) => ({
    thang: i + 1,
    doanhThuKhaiBao: 0,
    tienThucNhan: 0,
    ghiChu: null,
    ...(overrides[i] || {}),
  }));
}

describe('tinhDoiSoat', () => {
  it('tính chênh lệch và tỷ lệ đúng', () => {
    const months = makeMonths([{ doanhThuKhaiBao: 10_000_000, tienThucNhan: 8_000_000 }]);
    const result = tinhDoiSoat(months);
    expect(result[0].chenhLech).toBe(2_000_000);
    expect(result[0].tyLe).toBe(80);
  });

  it('doanhThuKhaiBao = 0 → tyLe = null (không chia cho 0)', () => {
    const months = makeMonths();
    const result = tinhDoiSoat(months);
    result.forEach((m) => {
      expect(m.tyLe).toBeNull();
    });
  });

  it('làm tròn tyLe về số nguyên', () => {
    const months = makeMonths([{ doanhThuKhaiBao: 3_000_000, tienThucNhan: 1_000_000 }]);
    const result = tinhDoiSoat(months);
    expect(result[0].tyLe).toBe(33); // 33.333... → 33
  });

  it('tienThucNhan > doanhThuKhaiBao → tyLe > 100, chenhLech âm', () => {
    const months = makeMonths([{ doanhThuKhaiBao: 5_000_000, tienThucNhan: 6_000_000 }]);
    const result = tinhDoiSoat(months);
    expect(result[0].tyLe).toBe(120);
    expect(result[0].chenhLech).toBe(-1_000_000);
  });

  it('giữ nguyên 12 phần tử và các trường gốc', () => {
    const months = makeMonths();
    const result = tinhDoiSoat(months);
    expect(result).toHaveLength(12);
    expect(result[5].thang).toBe(6);
    expect(result[5].ghiChu).toBeNull();
  });
});

describe('phatHienBatThuong', () => {
  it('< 3 tháng đủ dữ liệu → không flag bất thường, trungViTyLe = null', () => {
    const rows = [
      { thang: 1, doanhThuKhaiBao: 10_000_000, tienThucNhan: 8_000_000, tyLe: 80 },
      { thang: 2, doanhThuKhaiBao: 10_000_000, tienThucNhan: 7_000_000, tyLe: 70 },
      { thang: 3, doanhThuKhaiBao: 0, tienThucNhan: 0, tyLe: null },
    ];
    const { rows: out, trungViTyLe } = phatHienBatThuong(rows);
    expect(trungViTyLe).toBeNull();
    expect(out.every((r) => r.batThuong === false)).toBe(true);
  });

  it('tháng tụt sâu dưới median - nguong bị flag', () => {
    // median([50,85,88,90,92]) = 88; nguong=15 → ngưỡng = 73
    const rows = [
      { thang: 1, doanhThuKhaiBao: 10_000_000, tienThucNhan: 9_000_000, tyLe: 90 },
      { thang: 2, doanhThuKhaiBao: 10_000_000, tienThucNhan: 8_500_000, tyLe: 85 },
      { thang: 3, doanhThuKhaiBao: 10_000_000, tienThucNhan: 9_200_000, tyLe: 92 },
      { thang: 4, doanhThuKhaiBao: 10_000_000, tienThucNhan: 8_800_000, tyLe: 88 },
      { thang: 5, doanhThuKhaiBao: 10_000_000, tienThucNhan: 5_000_000, tyLe: 50 },
    ];
    const { rows: out, trungViTyLe } = phatHienBatThuong(rows);
    expect(trungViTyLe).toBe(88);
    expect(out[4].batThuong).toBe(true);  // tyLe=50 < 73
    expect(out[0].batThuong).toBe(false);
    expect(out[1].batThuong).toBe(false);
    expect(out[2].batThuong).toBe(false);
    expect(out[3].batThuong).toBe(false);
  });

  it('tháng tyLe = null không bị flag dù có >= 3 tháng đủ dữ liệu', () => {
    const rows = [
      { thang: 1, doanhThuKhaiBao: 10_000_000, tienThucNhan: 9_000_000, tyLe: 90 },
      { thang: 2, doanhThuKhaiBao: 10_000_000, tienThucNhan: 8_000_000, tyLe: 80 },
      { thang: 3, doanhThuKhaiBao: 10_000_000, tienThucNhan: 9_500_000, tyLe: 95 },
      { thang: 4, doanhThuKhaiBao: 0, tienThucNhan: 0, tyLe: null },
    ];
    const { rows: out } = phatHienBatThuong(rows);
    expect(out[3].batThuong).toBe(false);
  });

  it('ngưỡng tùy chỉnh (nguong=5)', () => {
    // sorted tyLe: [80,88,90,92], median=(88+90)/2=89, nguong=5 → ngưỡng=84
    // thang 4 (tyLe=80) < 84 → batThuong
    const rows = [
      { thang: 1, doanhThuKhaiBao: 10_000_000, tienThucNhan: 9_000_000, tyLe: 90 },
      { thang: 2, doanhThuKhaiBao: 10_000_000, tienThucNhan: 8_800_000, tyLe: 88 },
      { thang: 3, doanhThuKhaiBao: 10_000_000, tienThucNhan: 9_200_000, tyLe: 92 },
      { thang: 4, doanhThuKhaiBao: 10_000_000, tienThucNhan: 8_000_000, tyLe: 80 },
    ];
    const { rows: out, trungViTyLe } = phatHienBatThuong(rows, { nguong: 5 });
    expect(trungViTyLe).toBe(89);
    expect(out[3].batThuong).toBe(true);
    expect(out[0].batThuong).toBe(false);
    expect(out[1].batThuong).toBe(false);
    expect(out[2].batThuong).toBe(false);
  });

  it('tất cả tyLe gần nhau, không ai bất thường', () => {
    const rows = [
      { thang: 1, doanhThuKhaiBao: 10_000_000, tienThucNhan: 9_000_000, tyLe: 90 },
      { thang: 2, doanhThuKhaiBao: 10_000_000, tienThucNhan: 8_900_000, tyLe: 89 },
      { thang: 3, doanhThuKhaiBao: 10_000_000, tienThucNhan: 9_100_000, tyLe: 91 },
    ];
    const { rows: out } = phatHienBatThuong(rows);
    expect(out.every((r) => r.batThuong === false)).toBe(true);
  });
});
