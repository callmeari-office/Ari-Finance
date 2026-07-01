import { describe, it, expect } from 'vitest';
import {
  getEffectiveRoles,
  canViewCategory,
  isRestrictedToOwnProposals,
  canUseProposalCreatorFilter,
  defaultMenuAllowed,
  canViewMenu,
  canChonLamNguoiDeXuat,
} from './roles';

describe('getEffectiveRoles', () => {
  it('LEADER ke thua ca STAFF', () => {
    expect(getEffectiveRoles('LEADER')).toEqual(['LEADER', 'STAFF']);
  });

  it('vai tro khac tra chinh no', () => {
    expect(getEffectiveRoles('STAFF')).toEqual(['STAFF']);
    expect(getEffectiveRoles('OWNER')).toEqual(['OWNER']);
  });
});

describe('canViewCategory', () => {
  it('khop truc tiep', () => {
    expect(canViewCategory('STAFF', ['STAFF', 'MANAGER'])).toBe(true);
  });

  it('LEADER xem duoc danh muc cau hinh cho STAFF', () => {
    expect(canViewCategory('LEADER', ['STAFF'])).toBe(true);
  });

  it('khong co quyen', () => {
    expect(canViewCategory('STAFF', ['OWNER'])).toBe(false);
  });

  it('mang khong hop le -> false', () => {
    expect(canViewCategory('STAFF', null)).toBe(false);
    expect(canViewCategory('STAFF', undefined)).toBe(false);
    expect(canViewCategory('STAFF', 'STAFF')).toBe(false);
  });
});

describe('isRestrictedToOwnProposals', () => {
  it('STAFF va LEADER bi gioi han', () => {
    expect(isRestrictedToOwnProposals('STAFF')).toBe(true);
    expect(isRestrictedToOwnProposals('LEADER')).toBe(true);
  });

  it('OWNER/MANAGER khong bi gioi han', () => {
    expect(isRestrictedToOwnProposals('OWNER')).toBe(false);
    expect(isRestrictedToOwnProposals('MANAGER')).toBe(false);
  });
});

describe('canUseProposalCreatorFilter', () => {
  it('OWNER va MANAGER duoc dung bo loc nguoi de xuat', () => {
    expect(canUseProposalCreatorFilter('OWNER')).toBe(true);
    expect(canUseProposalCreatorFilter('MANAGER')).toBe(true);
  });

  it('LEADER/STAFF khong duoc dung bo loc nguoi de xuat', () => {
    expect(canUseProposalCreatorFilter('LEADER')).toBe(false);
    expect(canUseProposalCreatorFilter('STAFF')).toBe(false);
  });
});

describe('defaultMenuAllowed', () => {
  it('OWNER luon full quyen', () => {
    expect(defaultMenuAllowed('OWNER', 'cauHinh')).toBe(true);
    expect(defaultMenuAllowed('OWNER', 'quyen')).toBe(true);
  });

  it('STAFF khong duoc vao trang quan tri', () => {
    expect(defaultMenuAllowed('STAFF', 'quyen')).toBe(false);
    expect(defaultMenuAllowed('STAFF', 'nhanSu')).toBe(false);
    expect(defaultMenuAllowed('STAFF', 'duyet')).toBe(false);
  });

  it('STAFF duoc vao de xuat + NCC', () => {
    expect(defaultMenuAllowed('STAFF', 'deXuat')).toBe(true);
    expect(defaultMenuAllowed('STAFF', 'ncc')).toBe(true);
  });

  it('key khong ton tai -> false', () => {
    expect(defaultMenuAllowed('MANAGER', 'khongCoKeyNay')).toBe(false);
  });
});

describe('canViewMenu', () => {
  it('user null -> false', () => {
    expect(canViewMenu(null, 'deXuat')).toBe(false);
  });

  it('OWNER full quyen bat ke key', () => {
    expect(canViewMenu({ role: 'OWNER' }, 'cauHinh')).toBe(true);
  });

  it('permissions override dang boolean thang mac dinh', () => {
    expect(canViewMenu({ role: 'STAFF', permissions: { duyet: true } }, 'duyet')).toBe(true);
    expect(canViewMenu({ role: 'MANAGER', permissions: { thuChi: false } }, 'thuChi')).toBe(false);
  });

  it('tuong thich cau truc cu { xem: boolean }', () => {
    expect(canViewMenu({ role: 'STAFF', permissions: { duyet: { xem: true } } }, 'duyet')).toBe(true);
    expect(canViewMenu({ role: 'STAFF', permissions: { duyet: { xem: false } } }, 'duyet')).toBe(false);
  });

  it('khong co override -> dung mac dinh theo vai tro', () => {
    expect(canViewMenu({ role: 'STAFF', permissions: {} }, 'deXuat')).toBe(true);
    expect(canViewMenu({ role: 'STAFF', permissions: {} }, 'quyen')).toBe(false);
  });
});

describe('canChonLamNguoiDeXuat', () => {
  it('OWNER chon duoc bat ky ai ACTIVE, khac phong ban van duoc', () => {
    const nguoiTao = { role: 'OWNER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'MARKETING', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('MANAGER chon duoc STAFF cung phong ban', () => {
    const nguoiTao = { role: 'MANAGER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('MANAGER van chon duoc NV khac phong ban (chi xet rank)', () => {
    const nguoiTao = { role: 'MANAGER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'MARKETING', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('cung rank nhung khac phong ban van chon duoc nhau', () => {
    const nguoiTao = { role: 'LEADER', phongBan: 'FINANCE' };
    const target = { role: 'LEADER', phongBan: 'MARKETING', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('STAFF khong chon duoc cap tren (MANAGER) cung phong ban', () => {
    const nguoiTao = { role: 'STAFF', phongBan: 'FINANCE' };
    const target = { role: 'MANAGER', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(false);
  });

  it('STAFF chon duoc STAFF khac cung cap, cung phong ban', () => {
    const nguoiTao = { role: 'STAFF', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('khong chon duoc NV INACTIVE', () => {
    const nguoiTao = { role: 'MANAGER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'INACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(false);
  });

  it('thieu nguoiTao hoac target -> false', () => {
    expect(canChonLamNguoiDeXuat(null, { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'ACTIVE' })).toBe(false);
    expect(canChonLamNguoiDeXuat({ role: 'OWNER', phongBan: 'FINANCE' }, null)).toBe(false);
  });

  it('LEADER chon duoc STAFF cung phong ban', () => {
    const nguoiTao = { role: 'LEADER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('LEADER khong chon duoc MANAGER (cap tren) cung phong ban', () => {
    const nguoiTao = { role: 'LEADER', phongBan: 'FINANCE' };
    const target = { role: 'MANAGER', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(false);
  });

  it('role khong xac dinh (nguoiTao hoac target) -> false, khong fallback rank 0', () => {
    const nguoiTaoHopLe = { role: 'MANAGER', phongBan: 'FINANCE' };
    const targetLa = { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat({ role: 'HACKER', phongBan: 'FINANCE' }, targetLa)).toBe(false);
    expect(canChonLamNguoiDeXuat(nguoiTaoHopLe, { role: 'HACKER', phongBan: 'FINANCE', trangThai: 'ACTIVE' })).toBe(false);
  });
});
