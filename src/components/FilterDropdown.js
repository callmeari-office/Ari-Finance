'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './FilterDropdown.module.css';

/**
 * Excel-style multi-select filter dropdown.
 * Props:
 *   label    — tên cột hiển thị trên nút (vd: "Tháng")
 *   options  — [{ value, label }]
 *   selected — string[] — mảng các value đang chọn (rỗng = tất cả)
 *   onChange — (newSelected: string[]) => void
 */
export default function FilterDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAll = selected.length === 0;

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };

  const toggleAll = () => onChange([]);

  const displayValue = isAll
    ? 'Tất cả'
    : selected.length === 1
    ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
    : `${selected.length} lựa chọn`;

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger} ${!isAll ? styles.triggerActive : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.triggerInner}>
          <span className={styles.labelText}>{label}</span>
          <span className={styles.valueText}>{displayValue}</span>
        </span>
        <ChevronDown size={13} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHeader}>
            <span className={styles.dropTitle}>{label}</span>
            {!isAll && (
              <button className={styles.selectAll} onClick={toggleAll}>Xóa lọc</button>
            )}
          </div>
          <div className={styles.optionList}>
            <label className={`${styles.optionItem} ${styles.allOption}`}>
              <input type="checkbox" checked={isAll} onChange={toggleAll} />
              (Tất cả)
            </label>
            {options.map((opt) => (
              <label key={opt.value} className={styles.optionItem}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
