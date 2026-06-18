import { describe, it, expect } from 'vitest';
import { parseDateCell } from './helpers';

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
