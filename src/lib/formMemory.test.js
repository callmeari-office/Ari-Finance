import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFormMemory, writeFormMemory } from './formMemory';

// Mock localStorage đơn giản (môi trường test là 'node' → không có window sẵn).
function mockStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  };
}

describe('formMemory', () => {
  afterEach(() => {
    delete globalThis.window;
  });

  it('ghi rồi đọc lại đúng object', () => {
    globalThis.window = { localStorage: mockStorage() };
    writeFormMemory('phieu-thu', { quyId: 'q1', danhMucId: 'd1', noiDung: 'Tiền DT' });
    expect(readFormMemory('phieu-thu')).toEqual({ quyId: 'q1', danhMucId: 'd1', noiDung: 'Tiền DT' });
  });

  it('chưa có gì → null', () => {
    globalThis.window = { localStorage: mockStorage() };
    expect(readFormMemory('chua-co')).toBe(null);
  });

  it('JSON hỏng → null (không throw)', () => {
    const s = mockStorage();
    s.setItem('ari.formMemory.v1.hong', '{khong-phai-json');
    globalThis.window = { localStorage: s };
    expect(readFormMemory('hong')).toBe(null);
  });

  it('không có window (SSR) → read null, write không throw', () => {
    delete globalThis.window;
    expect(readFormMemory('x')).toBe(null);
    expect(() => writeFormMemory('x', { a: 1 })).not.toThrow();
  });

  it('localStorage throw khi ghi → nuốt lỗi', () => {
    globalThis.window = { localStorage: { getItem: () => null, setItem: () => { throw new Error('quota'); } } };
    expect(() => writeFormMemory('x', { a: 1 })).not.toThrow();
  });
});
