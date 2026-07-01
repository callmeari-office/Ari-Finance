import { canViewMenu } from './roles';

export async function getRolePermissions(db, role) {
  if (!role) return {};
  const row = await db.vaiTroQuyen.findUnique({ where: { role } });
  if (!row?.permissions) return {};

  try {
    const parsed = JSON.parse(row.permissions);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function hasApiPermission(db, user, key) {
  if (!user || user.trangThai !== 'ACTIVE') return false;
  if (user.role === 'OWNER') return true;

  const permissions = await getRolePermissions(db, user.role);
  return canViewMenu({ ...user, permissions }, key);
}

export async function requireApiPermission(db, user, key, message = 'Không có quyền.') {
  const allowed = await hasApiPermission(db, user, key);
  if (allowed) return null;
  return { error: message, status: user ? 403 : 401 };
}
