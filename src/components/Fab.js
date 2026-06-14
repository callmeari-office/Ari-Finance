'use client';
import styles from './Fab.module.css';

/**
 * Fab — Floating Action Button. Hiển thị chỉ trên mobile (≤768px).
 * Vị trí: góc dưới phải, phía trên BottomNav nếu có.
 */
export default function Fab({ onClick, icon, label, bottomOffset = '4.5rem' }) {
  return (
    <button
      type="button"
      className={styles.fab}
      onClick={onClick}
      aria-label={label}
      style={{ bottom: bottomOffset }}
    >
      {icon}
    </button>
  );
}
