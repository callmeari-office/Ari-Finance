import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('finance UX safety affordances', () => {
  it('confirm dialog defaults focus to cancel and guards danger Enter confirms', () => {
    const source = readSource('src/components/ConfirmDialog.js');

    expect(source).toContain('const cancelBtnRef = useRef(null);');
    expect(source).toContain('cancelBtnRef.current?.focus();');
    expect(source).toContain('handleDialogKeyDown');
    expect(source).toContain("danger && e.key === 'Enter'");
    expect(source).toContain('document.activeElement !== confirmBtnRef.current');
  });

  it('fund adjustment requires a danger confirmation before POST', () => {
    const source = readSource('src/app/quy/page.js');

    expect(source).toContain("import { useConfirm } from '@/components/ConfirmDialog';");
    expect(source).toContain('const showConfirm = useConfirm();');
    expect(source).toContain("title: 'Xác nhận điều chỉnh quỹ'");
    expect(source).toContain("cancelLabel: 'Kiểm tra lại'");
    expect(source).toContain('danger: true');
    expect(source.indexOf('const ok = await showConfirm({')).toBeLessThan(source.indexOf('setAdjustSubmitting(true);'));
  });

  it('approval page exposes mobile cards while preserving desktop tables', () => {
    const pageSource = readSource('src/app/de-xuat/duyet/page.js');
    const cssSource = readSource('src/app/de-xuat/duyet/duyet.module.css');

    expect(pageSource).toContain('renderApprovalMobileCards');
    expect(pageSource).toContain('getApprovalSummary');
    expect(pageSource).toContain('styles.desktopApprovalTable');
    expect(pageSource).toContain('styles.mobileApprovalCards');
    expect(cssSource).toContain('.mobileApprovalCards');
    expect(cssSource).toContain('.desktopApprovalTable');
  });

  it('bulk proposal create and mobile admin routes expose mobile-first controls', () => {
    const proposalSource = readSource('src/app/de-xuat/page.js');
    const proposalCss = readSource('src/app/de-xuat/de-xuat.module.css');
    const planSource = readSource('src/app/ke-hoach/page.js');
    const planCss = readSource('src/app/ke-hoach/ke-hoach.module.css');
    const staffSource = readSource('src/app/nhan-su/page.js');
    const staffCss = readSource('src/app/nhan-su/nhan-su.module.css');
    const permissionSource = readSource('src/app/quyen/page.js');
    const permissionCss = readSource('src/app/quyen/quyen.module.css');

    expect(proposalSource).toContain('renderBulkMobileCards');
    expect(proposalSource).toContain('styles.bulkStickyFooter');
    expect(proposalCss).toContain('.bulkMobileCards');
    expect(proposalCss).toContain('.bulkStickyFooter');
    expect(planSource).toContain('mobileEditMonth');
    expect(planSource).toContain('styles.mobileSaveFooter');
    expect(planCss).toContain('.mobilePlanEditor');
    expect(staffSource).toContain('styles.mobileEmployeeCards');
    expect(staffCss).toContain('.mobileEmployeeCards');
    expect(permissionSource).toContain('styles.mobilePermissionList');
    expect(permissionCss).toContain('.mobilePermissionList');
  });

  it('loading states and mobile navigation controls expose accessible labels', () => {
    const loaderSource = readSource('src/components/AriLoader.js');
    const filterSource = readSource('src/components/FilterDropdown.js');
    const sidebarSource = readSource('src/components/Sidebar.js');
    const sidebarCss = readSource('src/components/Sidebar.module.css');
    const bottomNavSource = readSource('src/components/BottomNav.js');

    expect(loaderSource).toContain('aria-live="polite"');
    expect(filterSource).toContain('aria-expanded={open}');
    expect(filterSource).toContain('aria-haspopup="listbox"');
    expect(bottomNavSource).toContain('aria-label={it.label}');
    expect(sidebarSource).toContain("aria-label={isOpen ? 'Đóng menu' : 'Mở menu'}");
    expect(sidebarSource).toContain('aria-expanded={isOpen}');
    expect(sidebarCss).toContain('min-width: 44px;');
    expect(sidebarCss).toContain('min-height: 44px;');
  });
});
