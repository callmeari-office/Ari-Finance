import { describe, it, expect } from 'vitest';
import { formatDate, formatDateOrEmpty } from './date';

describe('formatDate', () => {
  it('định dạng dd/mm/yy', () => {
    expect(formatDate('2026-06-13')).toBe('13/06/26');
    expect(formatDate(new Date(2026, 0, 5))).toBe('05/01/26'); // tháng 1, ngày 5 → pad 0
  });
  it('giá trị rỗng/không hợp lệ → "—"', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('khong-phai-ngay')).toBe('—');
  });
});

describe('formatDateOrEmpty', () => {
  it('định dạng dd/mm/yy', () => {
    expect(formatDateOrEmpty('2026-12-31')).toBe('31/12/26');
  });
  it('giá trị rỗng/không hợp lệ → chuỗi rỗng', () => {
    expect(formatDateOrEmpty(null)).toBe('');
    expect(formatDateOrEmpty('')).toBe('');
    expect(formatDateOrEmpty('rac')).toBe('');
  });
});
