import { describe, it, expect } from 'vitest';
import { toSoTien, tinhSoDuQuy, phanTramDat } from './finance';

describe('toSoTien', () => {
  it('giữ nguyên số hợp lệ', () => {
    expect(toSoTien(1500000)).toBe(1500000);
    expect(toSoTien(-200)).toBe(-200);
    expect(toSoTien(0)).toBe(0);
  });
  it('ép chuỗi số về number', () => {
    expect(toSoTien('1000')).toBe(1000);
  });
  it('giá trị rác → 0', () => {
    expect(toSoTien(null)).toBe(0);
    expect(toSoTien(undefined)).toBe(0);
    expect(toSoTien(NaN)).toBe(0);
    expect(toSoTien('abc')).toBe(0);
    expect(toSoTien(Infinity)).toBe(0);
  });
});

describe('tinhSoDuQuy', () => {
  it('công thức cơ bản: đầu kỳ + thu − chi + điều chỉnh', () => {
    expect(tinhSoDuQuy({ soDuDauKy: 1000, tongThu: 500, tongChi: 300, soDuDieuChinh: 50 })).toBe(1250);
  });
  it('không có điều chỉnh', () => {
    expect(tinhSoDuQuy({ soDuDauKy: 1000, tongThu: 500, tongChi: 300 })).toBe(1200);
  });
  it('số dư có thể âm', () => {
    expect(tinhSoDuQuy({ soDuDauKy: 0, tongThu: 100, tongChi: 500 })).toBe(-400);
  });
  it('trường thiếu → coi như 0', () => {
    expect(tinhSoDuQuy({ tongThu: 200 })).toBe(200);
    expect(tinhSoDuQuy({})).toBe(0);
    expect(tinhSoDuQuy()).toBe(0);
  });
  it('điều chỉnh âm trừ đúng', () => {
    expect(tinhSoDuQuy({ soDuDauKy: 1000, tongThu: 0, tongChi: 0, soDuDieuChinh: -250 })).toBe(750);
  });
  it('giá trị null/undefined trong field không làm hỏng phép tính', () => {
    expect(tinhSoDuQuy({ soDuDauKy: 1000, tongThu: null, tongChi: undefined, soDuDieuChinh: null })).toBe(1000);
  });
  it('cộng dồn số VND lớn vẫn chính xác', () => {
    expect(tinhSoDuQuy({ soDuDauKy: 999000000, tongThu: 1000000, tongChi: 0 })).toBe(1000000000);
  });
});

describe('phanTramDat', () => {
  it('tính % đạt được, làm tròn', () => {
    expect(phanTramDat(50, 100)).toBe(50);
    expect(phanTramDat(1, 3)).toBe(33);
    expect(phanTramDat(2, 3)).toBe(67);
    expect(phanTramDat(150, 100)).toBe(150);
  });
  it('chia cho 0 → 0 (không Infinity/NaN)', () => {
    expect(phanTramDat(100, 0)).toBe(0);
    expect(phanTramDat(100, null)).toBe(0);
    expect(phanTramDat(0, 0)).toBe(0);
  });
});
