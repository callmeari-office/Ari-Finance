import { describe, it, expect } from 'vitest';
import { generateVietQRUrl } from './vietqr';

const vcb = { tenNganHang: 'VCB - Vietcombank', soTaiKhoan: '0123456789', tenTaiKhoan: 'NGUYEN VAN A', tenNCC: 'NCC A' };

describe('generateVietQRUrl', () => {
  it('thiếu vendor → chuỗi rỗng', () => {
    expect(generateVietQRUrl(null, 1000, 'memo')).toBe('');
    expect(generateVietQRUrl(undefined, 1000, 'memo')).toBe('');
  });

  it('map mã ngân hàng viết tắt (VCB → vietcombank)', () => {
    const url = generateVietQRUrl(vcb, 50000, 'CP123');
    expect(url).toContain('img.vietqr.io/image/vietcombank-0123456789-compact.png');
    expect(url).toContain('amount=50000');
  });

  it('encode nội dung chuyển khoản + tên tài khoản', () => {
    const url = generateVietQRUrl(vcb, 1000, 'thanh toan CP 01');
    expect(url).toContain('addInfo=thanh%20toan%20CP%2001');
    expect(url).toContain('accountName=NGUYEN%20VAN%20A');
  });

  it('không có dấu "-" thì dùng nguyên tên làm mã', () => {
    const v = { tenNganHang: 'MB', soTaiKhoan: '999', tenTaiKhoan: 'X' };
    expect(generateVietQRUrl(v, 1, 'm')).toContain('/image/mb-999-compact.png');
  });

  it('ngân hàng không có trong map → dùng lowercase mã', () => {
    const v = { tenNganHang: 'XYZ - Ngan hang la', soTaiKhoan: '111', tenTaiKhoan: 'Y' };
    expect(generateVietQRUrl(v, 1, 'm')).toContain('/image/xyz-111-compact.png');
  });

  it('không có tenTaiKhoan thì fallback tenNCC', () => {
    const v = { tenNganHang: 'TCB', soTaiKhoan: '222', tenNCC: 'Cong ty B' };
    expect(generateVietQRUrl(v, 1, 'm')).toContain('accountName=Cong%20ty%20B');
  });
});
