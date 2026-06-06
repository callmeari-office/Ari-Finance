'use client';

/**
 * AriCameo — linh vật thương hiệu Call Me Ari.
 * Dùng thẳng ảnh logo gốc "Ari_Logo khong chu.png" (không chữ).
 * Hỗ trợ mọi size, className (animation), và tint màu qua CSS filter.
 *
 * Props:
 *  - size: px (mặc định 72)
 *  - color: nếu truyền '#hex' hoặc 'rgba(...)' → áp filter tint màu đó.
 *           Mặc định 'currentColor' → giữ màu nâu gốc của logo.
 *  - className: class ngoài (cho animation)
 */
export default function AriCameo({ size = 72, color = 'currentColor', className }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ari-cameo.png"
      width={size}
      height={size}
      alt="Call Me Ari"
      className={className}
      style={{ objectFit: 'contain', display: 'block' }}
      aria-label="Call Me Ari"
    />
  );
}
