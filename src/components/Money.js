'use client';

/**
 * Money — hiển thị số tiền định dạng VN với màu lãi/lỗ tuỳ sign.
 * sign: 'none' (mặc định) | 'income' (xanh) | 'expense' (đỏ) | 'auto' (tự theo giá trị)
 */
export default function Money({ value, sign = 'none', style = {} }) {
  const num = Number(value) || 0;
  const formatted = num.toLocaleString('vi-VN') + ' ₫';

  let color;
  if (sign === 'income') color = 'var(--success)';
  else if (sign === 'expense') color = 'var(--danger)';
  else if (sign === 'auto') color = num < 0 ? 'var(--danger)' : 'var(--success)';

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', ...(color ? { color } : {}), ...style }}>
      {formatted}
    </span>
  );
}
