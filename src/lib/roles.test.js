import { describe, it, expect } from 'vitest';
import {
  getEffectiveRoles,
  canViewCategory,
  isRestrictedToOwnProposals,
  defaultMenuAllowed,
  canViewMenu,
} from './roles';

describe('getEffectiveRoles', () => {
  it('LEADER kế thừa cả STAFF', () => {
    expect(getEffectiveRoles('LEADER')).toEqual(['LEADER', 'STAFF']);
  });
  it('vai trò khác trả chính nó', () => {
    expect(getEffectiveRoles('STAFF')).toEqual(['STAFF']);
    expect(getEffectiveRoles('OWNER')).toEqual(['OWNER']);
  });
});

describe('canViewCategory', () => {
  it('khớp trực tiếp', () => {
    expect(canViewCategory('STAFF', ['STAFF', 'MANAGER'])).toBe(true);
  });
  it('LEADER xem được danh mục cấu hình cho STAFF', () => {
    expect(canViewCategory('LEADER', ['STAFF'])).toBe(true);
  });
  it('không có quyền', () => {
    expect(canViewCategory('STAFF', ['OWNER'])).toBe(false);
  });
  it('mảng không hợp lệ → false', () => {
    expect(canViewCategory('STAFF', null)).toBe(false);
    expect(canViewCategory('STAFF', undefined)).toBe(false);
    expect(canViewCategory('STAFF', 'STAFF')).toBe(false);
  });
});

describe('isRestrictedToOwnProposals', () => {
  it('STAFF và LEADER bị giới hạn', () => {
    expect(isRestrictedToOwnProposals('STAFF')).toBe(true);
    expect(isRestrictedToOwnProposals('LEADER')).toBe(true);
  });
  it('OWNER/MANAGER không bị giới hạn', () => {
    expect(isRestrictedToOwnProposals('OWNER')).toBe(false);
    expect(isRestrictedToOwnProposals('MANAGER')).toBe(false);
  });
});

describe('defaultMenuAllowed', () => {
  it('OWNER luôn full quyền', () => {
    expect(defaultMenuAllowed('OWNER', 'cauHinh')).toBe(true);
    expect(defaultMenuAllowed('OWNER', 'quyen')).toBe(true);
  });
  it('STAFF không được vào trang quản trị', () => {
    expect(defaultMenuAllowed('STAFF', 'quyen')).toBe(false);
    expect(defaultMenuAllowed('STAFF', 'nhanSu')).toBe(false);
    expect(defaultMenuAllowed('STAFF', 'duyet')).toBe(false);
  });
  it('STAFF được vào đề xuất + NCC', () => {
    expect(defaultMenuAllowed('STAFF', 'deXuat')).toBe(true);
    expect(defaultMenuAllowed('STAFF', 'ncc')).toBe(true);
  });
  it('key không tồn tại → false', () => {
    expect(defaultMenuAllowed('MANAGER', 'khongCoKeyNay')).toBe(false);
  });
});

describe('canViewMenu', () => {
  it('user null → false', () => {
    expect(canViewMenu(null, 'deXuat')).toBe(false);
  });
  it('OWNER full quyền bất kể key', () => {
    expect(canViewMenu({ role: 'OWNER' }, 'cauHinh')).toBe(true);
  });
  it('permissions override dạng boolean thắng mặc định', () => {
    // STAFF mặc định KHÔNG được 'duyet', nhưng override = true
    expect(canViewMenu({ role: 'STAFF', permissions: { duyet: true } }, 'duyet')).toBe(true);
    // MANAGER mặc định ĐƯỢC 'thuChi', nhưng override = false
    expect(canViewMenu({ role: 'MANAGER', permissions: { thuChi: false } }, 'thuChi')).toBe(false);
  });
  it('tương thích cấu trúc cũ { xem: boolean }', () => {
    expect(canViewMenu({ role: 'STAFF', permissions: { duyet: { xem: true } } }, 'duyet')).toBe(true);
    expect(canViewMenu({ role: 'STAFF', permissions: { duyet: { xem: false } } }, 'duyet')).toBe(false);
  });
  it('không có override → dùng mặc định theo vai trò', () => {
    expect(canViewMenu({ role: 'STAFF', permissions: {} }, 'deXuat')).toBe(true);
    expect(canViewMenu({ role: 'STAFF', permissions: {} }, 'quyen')).toBe(false);
  });
});
