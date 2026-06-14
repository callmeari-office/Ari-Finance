'use client';
import Money from './Money';
import styles from './KpiCard.module.css';

/**
 * KpiCard — thẻ chỉ số tài chính Dashboard.
 * tone: 'brand' | 'income' | 'expense' | 'profit' (auto lãi/lỗ)
 */
export default function KpiCard({ label, value, money = false, moneySign, sub, icon, tone = 'brand', className = '' }) {
  const valueColor = {
    brand:   'var(--brand-brown)',
    income:  'var(--success)',
    expense: 'var(--danger)',
    profit:  (Number(value) || 0) < 0 ? 'var(--danger)' : 'var(--success)',
  }[tone] || 'var(--brand-brown)';

  const iconBg = {
    brand:   'rgba(var(--primary-rgb), 0.14)',
    income:  'var(--success-bg)',
    expense: 'var(--danger-bg)',
    profit:  'var(--info-bg)',
  }[tone] || 'rgba(var(--primary-rgb), 0.14)';

  return (
    <div className={`glass-card ${styles.card} ${className}`}>
      {icon && (
        <span className={styles.iconWrap} style={{ background: iconBg, color: valueColor }}>
          {icon}
        </span>
      )}
      <div className={styles.label}>{label}</div>
      <div className={styles.value} style={{ color: valueColor }}>
        {money
          ? <Money value={value} sign={moneySign || 'none'} />
          : value
        }
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
