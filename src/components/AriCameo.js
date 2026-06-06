'use client';

/**
 * AriCameo — linh vật thương hiệu Call Me Ari.
 * Khung oval cổ điển + chân dung nghiêng quý cô (gợi logo cameo nữ trang).
 * Dùng cho: loader, empty state, divider... trong Chế độ Ari.
 *
 * Props:
 *  - size: đường kính px (mặc định 72)
 *  - color: màu nét khung & chân dung (mặc định nâu mận thương hiệu)
 *  - className: class ngoài (cho animation)
 */
export default function AriCameo({ size = 72, color = 'currentColor', className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Call Me Ari"
    >
      {/* Khung oval kép cổ điển */}
      <ellipse cx="50" cy="58" rx="40" ry="50" stroke={color} strokeWidth="2" opacity="0.9" />
      <ellipse cx="50" cy="58" rx="34" ry="43.5" stroke={color} strokeWidth="1" opacity="0.55" />

      {/* Chân dung nghiêng quý cô (silhouette quay trái) */}
      <path
        d="M58 30
           c-9 -3 -19 2 -22 11
           c-2 6 -1 10 -4 14
           c-2 3 -5 4 -5 8
           c0 3 3 4 6 4
           c1 4 0 8 3 11
           c4 4 11 5 16 3
           l2 6
           c1 3 4 4 7 4
           c-3 -5 -2 -10 -1 -15
           c2 -9 5 -14 5 -23
           c0 -10 -3 -33 -16 -33 z"
        fill={color}
        opacity="0.92"
      />
      {/* Búi tóc + nơ ruy-băng phía sau */}
      <circle cx="68" cy="40" r="7" fill={color} opacity="0.92" />
      <path d="M73 36 l9 -5 l-2 8 l-7 1 z" fill={color} opacity="0.75" />
    </svg>
  );
}
