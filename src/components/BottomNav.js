'use client';
import styles from './BottomNav.module.css';

/**
 * BottomNav — thanh điều hướng đáy cho mobile (≤768px).
 * items: [{ key, label, icon: ReactNode, badge?: number }]
 * value: key đang active
 * onChange(key): callback khi bấm
 */
export default function BottomNav({ items = [], value, onChange }) {
  return (
    <nav className={styles.nav} role="navigation" aria-label="Điều hướng chính">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange && onChange(it.key)}
            className={`${styles.item} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {active && <span className={styles.indicator} />}
            <span className={styles.iconWrap}>
              {it.icon}
              {it.badge != null && it.badge > 0 && (
                <span className={styles.badge}>{it.badge > 99 ? '99+' : it.badge}</span>
              )}
            </span>
            <span className={styles.label}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
