import { describe, it, expect } from 'vitest';
import { validateAnhHoaDon, validateStorageImageUrl } from './validateImage';

// Tạo data URL với magic bytes đúng cho từng định dạng
function dataUrl(mime, bytes) {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

describe('validateAnhHoaDon', () => {
  it('chấp nhận JPEG/PNG/WebP magic bytes đúng', () => {
    expect(validateAnhHoaDon(dataUrl('image/jpeg', JPEG))).toBeNull();
    expect(validateAnhHoaDon(dataUrl('image/png', PNG))).toBeNull();
    expect(validateAnhHoaDon(dataUrl('image/webp', WEBP))).toBeNull();
  });

  it('từ chối MIME ngoài whitelist', () => {
    expect(validateAnhHoaDon(dataUrl('image/gif', JPEG))).toMatch(/JPEG, PNG hoặc WebP/);
    expect(validateAnhHoaDon(dataUrl('application/pdf', JPEG))).toBeTruthy();
  });

  it('từ chối magic bytes không khớp MIME (file giả mạo đuôi)', () => {
    // khai báo png nhưng nội dung là jpeg
    expect(validateAnhHoaDon(dataUrl('image/png', JPEG))).toMatch(/không khớp định dạng PNG/);
    expect(validateAnhHoaDon(dataUrl('image/jpeg', PNG))).toMatch(/không khớp định dạng JPEG/);
  });

  it('từ chối định dạng data URL sai', () => {
    expect(validateAnhHoaDon('khong-phai-data-url')).toBeTruthy();
    expect(validateAnhHoaDon('')).toBeTruthy();
  });

  it('từ chối input không phải string', () => {
    expect(validateAnhHoaDon(null)).toBeTruthy();
    expect(validateAnhHoaDon(123)).toBeTruthy();
    expect(validateAnhHoaDon(undefined)).toBeTruthy();
  });

  it('từ chối ảnh quá lớn (>2MB)', () => {
    const big = new Array(3 * 1024 * 1024).fill(0x00);
    big[0] = 0xff; big[1] = 0xd8; // header jpeg
    expect(validateAnhHoaDon(dataUrl('image/jpeg', big))).toMatch(/quá lớn/);
  });
});

describe('validateStorageImageUrl', () => {
  it('input không phải string → lỗi', () => {
    expect(validateStorageImageUrl(123)).toBeTruthy();
    expect(validateStorageImageUrl(null)).toBeTruthy();
  });
  // Hành vi phụ thuộc env SUPABASE_URL: nếu chưa cấu hình thì bỏ qua kiểm tra (trả null).
  it('không có SUPABASE_URL trong test env → bỏ qua kiểm tra', () => {
    const original = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    expect(validateStorageImageUrl('https://bat-ky.com/anh.png')).toBeNull();
    if (original !== undefined) process.env.SUPABASE_URL = original;
  });
  it('có SUPABASE_URL → chặn URL ngoài bucket, cho phép URL đúng bucket', () => {
    const original = process.env.SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://demo.supabase.co';
    const ok = 'https://demo.supabase.co/storage/v1/object/public/hoa-don/abc.webp';
    const bad = 'https://evil.com/storage/v1/object/public/hoa-don/abc.webp';
    expect(validateStorageImageUrl(ok)).toBeNull();
    expect(validateStorageImageUrl(bad)).toBeTruthy();
    if (original === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = original;
  });
});
