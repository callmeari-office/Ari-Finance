import { describe, expect, it, vi } from 'vitest';
import { hasApiPermission } from './permissions';

describe('hasApiPermission', () => {
  it('always allows OWNER even when no override row exists', async () => {
    const db = {
      vaiTroQuyen: {
        findUnique: vi.fn(),
      },
    };

    await expect(hasApiPermission(db, { role: 'OWNER', trangThai: 'ACTIVE' }, 'thuChi')).resolves.toBe(true);
    expect(db.vaiTroQuyen.findUnique).not.toHaveBeenCalled();
  });

  it('uses permissions override before default role permissions', async () => {
    const db = {
      vaiTroQuyen: {
        findUnique: vi.fn().mockResolvedValue({
          permissions: JSON.stringify({ thuChi: false, duyet: { xem: true } }),
        }),
      },
    };

    await expect(hasApiPermission(db, { role: 'MANAGER', trangThai: 'ACTIVE' }, 'thuChi')).resolves.toBe(false);
    await expect(hasApiPermission(db, { role: 'MANAGER', trangThai: 'ACTIVE' }, 'duyet')).resolves.toBe(true);
  });

  it('falls back to DEFAULT_MENU_ROLES when override row is missing or invalid', async () => {
    const db = {
      vaiTroQuyen: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ permissions: '{broken-json' }),
      },
    };

    await expect(hasApiPermission(db, { role: 'MANAGER', trangThai: 'ACTIVE' }, 'thuChi')).resolves.toBe(true);
    await expect(hasApiPermission(db, { role: 'STAFF', trangThai: 'ACTIVE' }, 'duyet')).resolves.toBe(false);
  });

  it('denies inactive or missing users', async () => {
    const db = {
      vaiTroQuyen: {
        findUnique: vi.fn(),
      },
    };

    await expect(hasApiPermission(db, null, 'thuChi')).resolves.toBe(false);
    await expect(hasApiPermission(db, { role: 'MANAGER', trangThai: 'INACTIVE' }, 'thuChi')).resolves.toBe(false);
  });
});
