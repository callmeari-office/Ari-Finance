# Kế hoạch triển khai #2 — Ô ngày `DateInput` (mở lịch khi chạm + sửa gõ tay)

> **Nguồn spec:** `web-app/2026-07-01-cai-tien-tong-quan-thu-chi-thong-bao-design.md` mục 2.
> **Lưu ý test:** Dự án ARI Finance là **JavaScript thuần, KHÔNG có test framework** (không jest/RTL). Quy ước verify của dự án: `npm run build` + kiểm thử tay (xem `CLAUDE.md`, `.claude/rules/coding-style.md`). Vì vậy plan này **thay bước "viết test tự động" bằng verify build + checklist kiểm thử tay** — thêm jest/RTL sẽ vi phạm "giữ app nhẹ / YAGNI". Nếu bạn muốn có test tự động, báo tôi, tôi sẽ thêm hạ tầng test riêng.

**Goal:** Trên mobile chạm ô ngày mở thẳng lịch (không bật bàn phím số); trên desktop gõ tay `dd/mm/yyyy` mượt, sửa số giữa chuỗi không nhảy caret; nút icon lịch vẫn mở được. Áp dụng cho **mọi** `DateInput` (chung 1 component).

**Architecture:** Sửa **1 component dùng chung** `src/components/DateInput.js`. (1) Phát hiện thiết bị cảm ứng bằng `matchMedia('(pointer: coarse)')` tính 1 lần sau mount (tránh lệch SSR/hydration). (2) Trên touch: ô text đóng vai trò trigger — chặn focus (không bật bàn phím) + gọi `showPicker()` của input `type=date` ẩn. (3) Trên desktop: giữ gõ tay, bảo toàn caret khi `autoFormat` chèn `/` bằng cách đếm số chữ số bên trái caret rồi đặt lại `selectionRange` trong `useLayoutEffect`. **Giữ nguyên hợp đồng props** (`value` ISO `yyyy-mm-dd`, `onChange`), không đụng 5 file đang dùng.

**Tech Stack:** React 19 (`'use client'`), Next.js 16 App Router, CSS Module sẵn có. Không thêm thư viện.

---

## File Structure

| File | Trách nhiệm | Thao tác |
|---|---|---|
| `src/components/DateInput.js` | Toàn bộ logic ô ngày (hiển thị, gõ tay, mở lịch, touch/desktop) | **Modify** |
| `src/components/DateInput.module.css` | Style wrapper/nút/hidden picker | Xem lại, chỉ sửa nếu cần con trỏ touch |

Không tạo file mới. Không đổi file nào gọi `DateInput` (5 file: `app/thu-chi/page.js`, `app/page.js`, `app/de-xuat/page.js`, `app/de-xuat/duyet/page.js`, và chính spec).

---

## Task 1: Bảo toàn caret khi gõ tay (desktop) + phát hiện touch + mở lịch khi chạm

**Files:**
- Modify: `src/components/DateInput.js` (toàn bộ component + 2 helper thuần ở đầu file)
- Xem lại: `src/components/DateInput.module.css`

- [ ] **Step 1: Thêm helper thuần `caretPosForDigits` (đặt cạnh `autoFormat`)**

Chèn ngay sau hàm `autoFormat` (dòng ~33), đây là hàm thuần, không phụ thuộc React:

```js
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
```

- [ ] **Step 2: Cập nhật import React + thêm layout-effect đồng hình (isomorphic)**

Đổi dòng import (dòng 2) và thêm hằng ngay dưới các import:

```js
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import styles from './DateInput.module.css';

// useLayoutEffect chạy client-side; guard để không cảnh báo khi SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

- [ ] **Step 3: Thêm state/ref mới trong component**

Ngay sau `const [display, setDisplay] = useState(...)` (dòng ~40), thêm:

```js
  const [isTouch, setIsTouch] = useState(false);
  const textRef = useRef(null);
  const caretRef = useRef(null); // vị trí caret mong muốn sau khi reformat (null = không đụng)
```

(Giữ nguyên `pickerRef` và `prevISO` đang có.)

- [ ] **Step 4: Thêm effect phát hiện touch (tính 1 lần sau mount)**

Thêm ngay trên effect "Sync khi parent đổi value" (dòng ~45):

```js
  // Phát hiện thiết bị cảm ứng (coarse pointer) — tính 1 lần sau mount để tránh lệch SSR/hydration.
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      setIsTouch(window.matchMedia('(pointer: coarse)').matches);
    }
  }, []);
```

- [ ] **Step 5: Thêm effect khôi phục caret (chỉ desktop, chỉ khi vừa gõ)**

Thêm ngay sau effect "Sync khi parent đổi value":

```js
  // Sau khi React set lại value (controlled), trình duyệt đẩy caret về cuối.
  // Khôi phục caret về vị trí logic đã tính trong handleChange.
  useIsoLayoutEffect(() => {
    if (caretRef.current != null && textRef.current) {
      const pos = caretRef.current;
      caretRef.current = null;
      try { textRef.current.setSelectionRange(pos, pos); } catch { /* input không hỗ trợ selection */ }
    }
  });
```

- [ ] **Step 6: Sửa `handleChange` để tính & lưu caret mong muốn**

Thay toàn bộ `handleChange` (dòng ~52-60) bằng:

```js
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
```

- [ ] **Step 7: Thêm handler mở lịch khi chạm (touch) — chặn focus để không bật bàn phím**

Thêm hàm mới ngay trên `openPicker` (dòng ~79):

```js
  // Touch: chạm ô = mở lịch. preventDefault trên pointerdown để KHÔNG focus ô text (tránh bàn phím số).
  function handleTouchTrigger(e) {
    if (!isTouch) return;
    e.preventDefault();
    openPicker();
  }
```

(Giữ nguyên `openPicker` hiện có — đã có `showPicker()` + fallback `.click()`.)

- [ ] **Step 8: Gắn `ref`, hành vi touch vào input text (JSX)**

Trong `<input type="text">` (dòng ~86-102): thêm `ref`, đổi `inputMode`, thêm `onPointerDown`/`onClick`, và **KHÔNG** dùng `readOnly` (giữ để `required` vẫn được validate trên mobile). Kết quả:

```jsx
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
        onClick={isTouch ? openPicker : undefined}
        className={`${className || ''} ${styles.textInput}`}
        style={inputStyle}
        required={required}
        disabled={disabled}
        maxLength={10}
        pattern="\d{2}/\d{2}/\d{4}"
        title={title || 'Nhập ngày theo định dạng dd/mm/yyyy'}
        autoComplete="off"
      />
```

Ghi chú: `onPointerDown` đã `preventDefault` (chặn focus) rồi mới `openPicker`; `onClick` là fallback cho trình duyệt không kích hoạt `showPicker` từ pointerdown. Trên desktop cả hai `return` sớm/`undefined` → hành vi gõ tay giữ nguyên. `handleBlur` bỏ trên touch (không còn nhập nửa chừng).

- [ ] **Step 9: (Nếu cần) con trỏ tay trên touch — CSS**

Kiểm tra khi chạy: nếu muốn ô hiện con trỏ "pointer" trên touch để gợi ý bấm được. Chỉ thêm nếu thấy cần, dùng biến sẵn có, KHÔNG hardcode màu. Ví dụ thêm vào `DateInput.module.css`:

```css
/* Touch: ô ngày là trigger mở lịch → con trỏ pointer */
@media (pointer: coarse) {
  .textInput { cursor: pointer; }
}
```

(Bước tùy chọn — mặc định bỏ qua nếu không cần thiết.)

- [ ] **Step 10: Verify build**

Run (trong `web-app/`):
```
npm run build
```
Expected: `✓ Compiled successfully`, 75 pages generated, không lỗi TypeScript/JSX. (KHÔNG dùng `npm run lint` — ESLint lỗi môi trường.)

- [ ] **Step 11: Đọc lại `DateInput.js` soát logic biên**

Tự đọc lại file vừa sửa, xác nhận:
- `caretRef` chỉ được set trong `handleChange`, effect khôi phục caret có guard `!= null` → không đụng caret ở render do đổi `isTouch`/sync `value`.
- Desktop: `onPointerDown` return sớm (`!isTouch`), `onBlur=handleBlur` vẫn xóa nhập nửa chừng.
- Touch: `inputMode='none'`, focus bị chặn, `showPicker()` gọi từ user gesture.
- Hợp đồng props (`value`, `onChange`, `min`, `max`, `disabled`, `required`, `className`, `inputStyle`, `style`, `title`, `id`) không đổi.

- [ ] **Step 12: Kiểm thử tay (ghi lại kết quả, KHÔNG commit)**

Chạy `npm run dev`, mở `http://localhost:3000`.

**Desktop (chuột + bàn phím):**
- Trang Thu-Chi → modal → ô "Ngày giao dịch": gõ `30/06/2026` → dấu `/` tự chèn, caret theo kịp, không nhảy về cuối.
- Đặt caret giữa chuỗi, gõ/xóa 1 số → caret giữ đúng vị trí logic, không nhảy về cuối, không bị chặn.
- Bấm icon lịch → mở bảng chọn; chọn 1 ngày → ô hiển thị đúng `dd/mm/yyyy`, giá trị lưu ISO đúng.
- Bỏ trống nửa chừng rồi rời ô (blur) → tự xóa (hành vi cũ giữ nguyên).

**Mobile (DevTools bật "pointer: coarse" hoặc máy thật):**
- DevTools → Rendering → Emulate CSS media `pointer: coarse`, hoặc device toolbar. Reload trang.
- Chạm ô ngày → **mở thẳng lịch**, **không** bật bàn phím số.
- Chọn ngày từ lịch → giá trị đồng bộ đúng.
- Nút icon lịch vẫn mở lịch.

**Regression (mọi nơi dùng chung):** mở nhanh các ô ngày ở: Thu-Chi (3 ô), Trang chủ `page.js` (1 ô), Đề xuất `de-xuat` (5 ô), Duyệt `de-xuat/duyet` (6 ô) → render bình thường, gõ/chọn ngày OK.

---

## Self-Review (đã rà theo skill)

**1. Spec coverage** — đối chiếu mục 2 của spec:
- "Mobile chạm → mở lịch, không bàn phím số" → Step 7-8 (`inputMode='none'` + `preventDefault` focus + `showPicker`). ✅
- "Desktop gõ tay + nút lịch, sửa giữa chuỗi mượt" → Step 1,5,6 (caret preservation) + `openPicker` sẵn có. ✅
- "Phát hiện coarse pointer, tính 1 lần sau mount tránh lệch SSR" → Step 4. ✅
- "Bảo toàn caret khi autoFormat chèn `/`" → Step 1 + Step 5 + Step 6. ✅
- "Giữ nguyên hợp đồng props, không phá nơi đang dùng" → không đổi 5 file gọi; Step 11 kiểm tra; Step 12 regression. ✅
- "Áp dụng mọi DateInput" → sửa component dùng chung. ✅

**2. Placeholder scan** — Step 9 là bước **tùy chọn có điều kiện** (đã ghi rõ "mặc định bỏ qua"), không phải placeholder mơ hồ; mọi bước khác có code/lệnh cụ thể. ✅

**3. Type/tên nhất quán** — `caretRef`, `textRef`, `isTouch`, `handleTouchTrigger`, `caretPosForDigits`, `useIsoLayoutEffect` dùng thống nhất giữa các bước. Hợp đồng `onChange({ target: { value: iso } })` giữ nguyên như bản gốc. ✅

**Rủi ro đã cân nhắc:**
- **`readOnly` + `required`**: cố ý KHÔNG dùng `readOnly` trên touch vì input readonly bị loại khỏi constraint validation → `required` mất tác dụng trên mobile. Thay bằng chặn focus qua `preventDefault` (required vẫn chạy). 
- **Hydration**: `isTouch` khởi tạo `false` = giống server ở lần render client đầu → không lệch hydration; cập nhật `isTouch` là state update bình thường sau mount.
- **`showPicker()` throw**: đã có `try/catch` fallback `.click()` trong `openPicker`.
