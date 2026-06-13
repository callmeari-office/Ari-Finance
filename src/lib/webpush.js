/**
 * webpush.js — wrapper gửi Web Push Notification
 * Chỉ dùng server-side (API routes). KHÔNG import vào client component.
 */
import webpush from 'web-push';
import { prisma } from './prisma.js';

// Cấu hình VAPID một lần khi module được load — chỉ khi đủ keys
const vapidReady =
  process.env.VAPID_SUBJECT &&
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY;

if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Gửi push tới 1 subscription. Nếu subscription hết hạn (410/404) → tự xóa khỏi DB.
 * @param {object} sub - { endpoint, p256dh, auth }
 * @param {object} payload - { title, body, url?, icon? }
 */
async function sendToOne(sub, payload) {
  if (!vapidReady) return; // VAPID chưa cấu hình → bỏ qua
  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'ari-finance',
  });

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      pushPayload,
      { TTL: 86400 } // tồn tại tối đa 24h nếu device offline
    );
  } catch (err) {
    // 410 Gone hoặc 404 = subscription không còn hợp lệ → xóa để tránh gửi vô ích
    if (err.statusCode === 410 || err.statusCode === 404) {
      await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
    }
    // Các lỗi khác (network timeout v.v.) bỏ qua, không throw
  }
}

/**
 * Gửi push tới toàn bộ OWNER + MANAGER đang ACTIVE có subscription.
 */
export async function notifyManagers(payload) {
  const subs = await prisma.pushSubscription.findMany({
    where: {
      nhanVien: {
        trangThai: 'ACTIVE',
        role: { in: ['OWNER', 'MANAGER'] },
      },
    },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  await Promise.allSettled(subs.map((s) => sendToOne(s, payload)));
}

/**
 * Gửi push tới toàn bộ OWNER đang ACTIVE có subscription.
 */
export async function notifyOwners(payload) {
  const subs = await prisma.pushSubscription.findMany({
    where: {
      nhanVien: {
        trangThai: 'ACTIVE',
        role: 'OWNER',
      },
    },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  await Promise.allSettled(subs.map((s) => sendToOne(s, payload)));
}

/**
 * Gửi push tới subscription của 1 user cụ thể (theo userId).
 */
export async function notifyUser(userId, payload) {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  await Promise.allSettled(subs.map((s) => sendToOne(s, payload)));
}

/**
 * Gửi thông báo khi duyệt đề xuất đến:
 * 1. Tất cả OWNER + MANAGER (qua notifyManagers)
 * 2. Người tạo đề xuất (nếu người tạo là LEADER hoặc STAFF)
 */
export async function notifyProposalApproved(creatorId, payload) {
  try {
    // 1. Gửi cho tất cả Owner + Manager đang hoạt động
    await notifyManagers(payload);

    // 2. Tìm thông tin người tạo đề xuất để kiểm tra vai trò
    const creator = await prisma.nhanVien.findUnique({
      where: { id: creatorId },
      select: { role: true, trangThai: true },
    });

    // Nếu người tạo là LEADER hoặc STAFF và đang hoạt động, gửi thông báo riêng cho họ
    // (Vì họ không nằm trong nhóm OWNER/MANAGER ở bước 1)
    if (creator && creator.trangThai === 'ACTIVE' && (creator.role === 'LEADER' || creator.role === 'STAFF')) {
      await notifyUser(creatorId, payload);
    }
  } catch (error) {
    // Bỏ qua lỗi để không làm ảnh hưởng luồng nghiệp vụ chính
    console.error('Lỗi khi gửi thông báo duyệt đề xuất:', error);
  }
}
