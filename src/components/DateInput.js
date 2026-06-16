'use client';
import { useState, useEffect, useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import styles from './DateInput.module.css';

// yyyy-mm-dd → dd/mm/yyyy
function toDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

// dd/mm/yyyy → yyyy-mm-dd ('' nếu không hợp lệ)
function toISO(display) {
  if (!display || display.length < 10) return '';
  const parts = display.split('/');
  if (parts.length !== 3 || parts[2].length !== 4) return '';
  const [d, m, y] = parts;
  const day = parseInt(d, 10), month = parseInt(m, 10), year = parseInt(y, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return '';
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Tự động chèn dấu / sau dd và mm
function autoFormat(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * DateInput — hiển thị dd/mm/yyyy, value/onChange dùng yyyy-mm-dd.
 * Props: id, value, onChange, className, required, disabled, min, max, style, title
 */
export default function DateInput({ id, value, onChange, className, required, disabled, min, max, style, inputStyle, title }) {
  const [display, setDisplay] = useState(() => toDisplay(value));
  const pickerRef = useRef(null);
  const prevISO = useRef(value);

  // Sync khi parent đổi value từ bên ngoài
  useEffect(() => {
    if (value !== prevISO.current) {
      prevISO.current = value;
      setDisplay(toDisplay(value));
    }
  }, [value]);

  function handleChange(e) {
    const newDisplay = autoFormat(e.target.value);
    setDisplay(newDisplay);
    const iso = toISO(newDisplay);
    if (iso || newDisplay === '') {
      prevISO.current = iso;
      onChange({ target: { value: iso } });
    }
  }

  function handleBlur() {
    const iso = toISO(display);
    if (!iso && display !== '') {
      // Nhập nửa chừng → xóa
      setDisplay('');
      prevISO.current = '';
      onChange({ target: { value: '' } });
    }
  }

  function handlePickerChange(e) {
    const iso = e.target.value;
    prevISO.current = iso;
    onChange({ target: { value: iso } });
    setDisplay(toDisplay(iso));
  }

  function openPicker() {
    try { pickerRef.current?.showPicker(); }
    catch { pickerRef.current?.click(); }
  }

  return (
    <div className={styles.wrap} style={style}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`${className || ''} ${styles.textInput}`}
        style={inputStyle}
        required={required}
        disabled={disabled}
        maxLength={10}
        pattern="\d{2}/\d{2}/\d{4}"
        title={title || 'Nhập ngày theo định dạng dd/mm/yyyy'}
        autoComplete="off"
      />
      <button
        type="button"
        className={styles.calBtn}
        onClick={openPicker}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Chọn ngày"
      >
        <CalendarDays size={15} />
      </button>
      {/* Hidden date picker — chỉ để mở native calendar */}
      <input
        ref={pickerRef}
        type="date"
        value={value || ''}
        onChange={handlePickerChange}
        min={min}
        max={max}
        className={styles.hiddenPicker}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
      />
    </div>
  );
}
