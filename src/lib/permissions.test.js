import fs from 'node:fs';
import path from 'node:path';
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

describe('sensitive api routes enforce permission overrides', () => {
  const route = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

  it('thu-chi route enforces thuChi permission for GET and POST', () => {
    const source = route('src/app/api/thu-chi/route.js');

    expect(source).toContain("import { hasApiPermission } from '@/lib/permissions';");
    expect(source).toContain("hasApiPermission(prisma, user, 'thuChi')");
  });

  it('approval routes enforce duyet permission', () => {
    const single = route('src/app/api/de-xuat/[id]/route.js');
    const many = route('src/app/api/de-xuat/duyet-nhieu/route.js');
    const grouped = route('src/app/api/de-xuat/duyet-gop/route.js');

    for (const source of [single, many, grouped]) {
      expect(source).toContain("import { hasApiPermission } from '@/lib/permissions';");
      expect(source).toContain("hasApiPermission(prisma, user, 'duyet')");
    }
  });
});
