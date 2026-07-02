'use client';

import AriCameo from './AriCameo';
import styles from './AriLoader.module.css';

/**
 * AriLoader — màn chờ tải mang ADN Call Me Ari:
 * cameo "thở" nhẹ bên trong vòng ánh kim đang quay.
 * Đẹp ở cả 3 chế độ, lung linh nhất ở Chế độ Ari.
 *
 * Props:
 *  - text: dòng chữ phụ (mặc định "Đang tải...")
 *  - size: cỡ cameo (mặc định 52)
 */
export default function AriLoader({ text = 'Đang tải...', size = 52 }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.ring}>
        <AriCameo size={size} className={styles.cameo} />
      </div>
      {text && <p className={styles.caption}>{text}</p>}
    </div>
  );
}
