import { describe, expect, it } from 'vitest';
import {
  buildThuCreatedInternalNotification,
  buildThuCreatedInternalNotificationNeedle,
  THU_CREATED_INTERNAL_NOTIFICATION_TITLE,
} from './internalNotifications';

describe('buildThuCreatedInternalNotification', () => {
  it('builds an in-app notification payload for a newly created THU transaction', () => {
    const payload = buildThuCreatedInternalNotification({
      maPhieu: 'TC2606-0107',
      soTien: 50013000,
      noiDung: 'Bo sung tien thu clear chi thuc te',
      tenQuy: 'MB Bank (CMA)',
      tenNguoiTao: 'Chu shop',
    });

    expect(payload).toEqual({
      tieuDe: THU_CREATED_INTERNAL_NOTIFICATION_TITLE,
      noiDung: 'Chu shop vua ghi nhan phiếu THU TC2606-0107: +50.013.000đ vao quy MB Bank (CMA) - Bo sung tien thu clear chi thuc te',
      tag: 'THONG_TIN',
    });
  });
});

describe('buildThuCreatedInternalNotificationNeedle', () => {
  it('returns a stable receipt marker so old notifications can be archived on delete', () => {
    expect(buildThuCreatedInternalNotificationNeedle('TC2606-0107')).toBe('phiếu THU TC2606-0107:');
  });
});
