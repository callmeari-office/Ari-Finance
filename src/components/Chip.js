'use client';
import styles from './Chip.module.css';

/**
 * Chip — filter chip bật/tắt theo design system.
 * active  : boolean — trạng thái được chọn
 * count   : number | undefined — badge số đếm góc phải
 * icon    : ReactNode — icon trái (tuỳ chọn)
 */
export default function Chip({ active = false, onClick, icon, count, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${styles.chip} ${active ? styles.active : ''} ${className}`.trim()}
      {...rest}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
      {count != null && (
        <span className={`${styles.count} ${active ? styles.countActive : ''}`}>
          {count}
        </span>
      )}
    </button>
  );
}
