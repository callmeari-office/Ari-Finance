'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import styles from './DateInput.module.css';

// useLayoutEffect chạy client-side; guard để không cảnh báo khi SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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

// Vị trí caret trong chuỗi đã format sao cho có đúng `n` chữ số ở bên trái.
// Dùng để giữ caret đúng chỗ khi autoFormat chèn/bỏ dấu '/'.
function caretPosForDigits(formatted, n) {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= '0' && formatted[i] <= '9') {
      count++;
      if (count === n) return i + 1;
    }
  }
  return formatted.length;
}

/**
 * DateInput — hiển thị dd/mm/yyyy, value/onChange dùng yyyy-mm-dd.
 * Props: id, value, onChange, className, required, disabled, min, max, style, title
 */
export default function DateInput({ id, value, onChange, className, required, disabled, min, max, style, inputStyle, title }) {
  const [display, setDisplay] = useState(() => toDisplay(value));
  const [isTouch, setIsTouch] = useState(false);
  const pickerRef = useRef(null);
  const textRef = useRef(null);
  const caretRef = useRef(null); // vị trí caret mong muốn sau khi reformat (null = không đụng)
  const prevISO = useRef(value);

  // Phát hiện thiết bị cảm ứng (coarse pointer) — tính 1 lần sau mount để tránh lệch SSR/hydration.
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      setIsTouch(window.matchMedia('(pointer: coarse)').matches);
    }
  }, []);

  // Sync khi parent đổi value từ bên ngoài
  useEffect(() => {
    if (value !== prevISO.current) {
      prevISO.current = value;
      setDisplay(toDisplay(value));
    }
  }, [value]);

  // Sau khi React set lại value (controlled), trình duyệt đẩy caret về cuối.
  // Khôi phục caret về vị trí logic đã tính trong handleChange.
  useIsoLayoutEffect(() => {
    if (caretRef.current != null && textRef.current) {
      const pos = caretRef.current;
      caretRef.current = null;
      try { textRef.current.setSelectionRange(pos, pos); } catch { /* input không hỗ trợ selection */ }
    }
  });

  function handleChange(e) {
    const raw = e.target.value;
    const rawCaret = e.target.selectionStart ?? raw.length;
    // Đếm số chữ số bên trái caret trong chuỗi thô (bất biến qua reformat)
    const digitsLeft = raw.slice(0, rawCaret).replace(/\D/g, '').length;
    const newDisplay = autoFormat(raw);
    caretRef.current = caretPosForDigits(newDisplay, digitsLeft);
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

  // Touch: chạm ô = mở lịch. preventDefault trên pointerdown để KHÔNG focus ô text (tránh bàn phím số).
  function handleTouchTrigger(e) {
    if (!isTouch) return;
    e.preventDefault();
    openPicker();
  }

  function openPicker() {
    try { pickerRef.current?.showPicker(); }
    catch { pickerRef.current?.click(); }
  }

  return (
    <div className={styles.wrap} style={style}>
      <input
        id={id}
        ref={textRef}
        type="text"
        inputMode={isTouch ? 'none' : 'numeric'}
        placeholder="dd/mm/yyyy"
        value={display}
        onChange={handleChange}
        onBlur={isTouch ? undefined : handleBlur}
        onPointerDown={handleTouchTrigger}
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
