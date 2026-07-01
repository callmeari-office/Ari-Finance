# Thiết kế — Đợt cải tiến Tổng quan · Ô ngày · Nhớ phiếu · Lỗi font

> Ngày: 2026-07-01 · Phạm vi: `web-app/`
> Nguồn: brainstorm với chủ shop (4 vấn đề từ trải nghiệm thực tế trên mobile).

Bốn cải tiến độc lập, có thể làm & kiểm thử riêng:

1. Bộ chọn tháng ở màn Tổng quan (xem lại số liệu tháng cũ).
2. Ô ngày mở lịch ngay khi chạm trên mobile + sửa lỗi gõ tay trên desktop.
3. Nhớ/gợi ý thông tin khi nhập phiếu thu-chi.
4. Sửa lỗi font (mojibake) trong thông báo & giao diện.

---

## 1. Bộ chọn tháng ở Tổng quan

### Vấn đề
Màn Tổng quan (`src/app/page.js`) hardcode tháng hiện tại bằng `new Date()`. Khối "SỨC KHỎE TÀI CHÍNH" luôn cố định tháng này, không xem lại được tháng cũ.

### Nguyên tắc thiết kế
**Số nào thuộc về một tháng → đổi theo tháng chọn. Số nào tức thời → luôn giữ hiện tại.**

### Hành vi
Thêm thanh chọn tháng `‹ Tháng 7/2026 ›` ở đầu khối "SỨC KHỎE TÀI CHÍNH":
- Mặc định = tháng hiện tại.
- Lùi được về các tháng có dữ liệu; **không cho vượt** tháng hiện tại (nút `›` disabled ở tháng hiện tại).
- Đổi tháng chỉ nạp lại khối sức khỏe tài chính, không reload cả trang.

| Thành phần | Xử lý |
|---|---|
| Doanh thu tháng (so chỉ tiêu) | Đổi theo tháng chọn |
| Chi phí tháng (so kế hoạch) | Đổi theo tháng chọn |
| Lãi/Lỗ + biên lợi nhuận | Đổi theo tháng chọn |
| **Tiền đang có** (số dư 4 quỹ) | **Luôn hiện tại** — số dư tức thời, không có "số dư cuối tháng quá khứ". Thêm nhãn nhỏ *"hiện tại"* |
| Dòng dự báo: "Sắp tới hạn 7 ngày", "ước cả tháng", "lãi ước cả tháng" | **Chỉ hiện ở tháng hiện tại/tương lai.** Xem tháng quá khứ → ẩn, chỉ hiện số thực tế đã chốt |
| Biểu đồ Thu-Chi-Lãi 6 tháng | Giữ nguyên (vốn đã là lịch sử) |
| "Đề xuất theo người" + Cảnh báo | **Giữ tháng hiện tại**, KHÔNG gắn bộ chọn — đây là "việc cần xử lý ngay", tránh nhầm với phiếu chờ duyệt của quá khứ |

### Kỹ thuật
- Thêm state `selectedMonth` (dạng `YYYY-MM`) ở `page.js`, mặc định tháng hiện tại.
- Các API cấp số liệu tháng nhận thêm query param `thang=YYYY-MM` (mặc định = tháng hiện tại nếu không truyền, giữ tương thích ngược). Cần rà: `/api/loi-nhuan`, `/api/ke-hoach`, `/api/doanh-thu`, và nguồn cấp doanh thu/chi phí tháng cho dashboard.
- Tuân thủ bất biến nguồn chi phí trong `.claude/rules/data-sources.md` (ThuChi + DeXuatChiPhi laLichSu) — không đổi công thức, chỉ đổi khoảng tháng lọc.
- Khi `selectedMonth` là quá khứ: ẩn các dòng ước tính/dự báo (điều kiện render theo `selectedMonth === thángHiệnTại`).

### Kiểm thử
- Chọn tháng cũ → 3 thẻ số đổi đúng; "Tiền đang có" không đổi.
- Tháng quá khứ → không thấy dòng "ước cả tháng"/"sắp tới hạn".
- Không lùi quá tháng có dữ liệu; không tiến quá tháng hiện tại.

---

## 2. Ô ngày — mở lịch khi chạm (mobile) + sửa gõ tay (desktop)

### Vấn đề
`src/components/DateInput.js` hiển thị ô text `dd/mm/yyyy` + nút lịch nhỏ tách riêng. Trên mobile, chạm ô → bật bàn phím số (bất tiện). Trên desktop, bấm vào sửa số giữa chuỗi bị lỗi (nghi caret nhảy do `autoFormat` reformat toàn bộ chuỗi mỗi lần gõ).

### Hành vi mong muốn
- **Mobile**: chạm ô ngày → mở thẳng bảng lịch (native date picker), không bật bàn phím số.
- **Desktop**: vừa gõ tay `dd/mm/yyyy` được, vừa bấm nút/icon lịch mở bảng chọn được. Sửa số giữa chuỗi phải mượt (không nhảy caret, không chặn sửa).
- Áp dụng cho **mọi** `DateInput` trong app (thu, chi, đề xuất, kế hoạch...) vì tất cả đã dùng chung component.

### Kỹ thuật
- Phát hiện thiết bị cảm ứng (coarse pointer) — ví dụ `matchMedia('(pointer: coarse)')`, tính 1 lần sau mount để tránh lệch SSR/hydration.
  - Touch: ô hiển thị đóng vai trò trigger, chạm → gọi `showPicker()` của input `type=date` ẩn (fallback `.click()`); không focus ô text để tránh bàn phím.
  - Desktop: giữ ô text gõ tay + nút icon lịch mở `showPicker()`.
- Sửa bug gõ tay desktop: bảo toàn vị trí caret khi `autoFormat` chèn dấu `/` (điều chỉnh selectionStart sau khi set giá trị), để sửa số ở giữa không bị nhảy về cuối / không bị chặn.
- Giữ nguyên hợp đồng props hiện tại (`value` ISO `yyyy-mm-dd`, `onChange`), không phá các nơi đang dùng.

### Kiểm thử
- Mobile (hoặc DevTools mô phỏng coarse pointer): chạm → hiện lịch, không hiện bàn phím số.
- Desktop: gõ `30/06/2026` mượt; click giữa "3|0" sửa thành "31" được; bấm icon lịch mở bảng.
- Chọn ngày từ lịch → giá trị đồng bộ đúng ở cả 2 chế độ.

---

## 3. Nhớ/gợi ý thông tin khi nhập phiếu

Hai loại phiếu bản chất khác nhau → xử lý khác nhau.

### 3a. Phiếu thu (modal TH4 trong `src/app/thu-chi/page.js`)
Lặp lại nhiều: cùng quỹ, cùng danh mục ("Thu từ bán hàng"), cùng nội dung ("Tiền DT"), chỉ khác số tiền.

- **Tự điền sẵn** `quyId` + `danhMucId` + `noiDung` theo **lần nhập thành công gần nhất**.
- Lưu ở `localStorage` (key riêng cho phiếu thu), nạp khi mở modal. Số tiền luôn để trống.
- Nếu giá trị đã lưu không còn hợp lệ (quỹ/danh mục bị xóa) → bỏ qua, dùng mặc định cũ.

### 3b. Phiếu chi (`src/app/de-xuat/page.js`)
Đa dạng: khác nhà cung cấp, nội dung, số tiền → KHÔNG tự điền nội dung/số tiền (dễ nhầm).

- Thêm nút **"Tạo phiếu tương tự"** trên mỗi phiếu đã tạo (trong danh sách) → nhân bản nhanh sang form khi có một loạt phiếu giống nhau (copy nội dung/danh mục/ai trả, để trống ngày phát sinh = hôm nay, số tiền tùy: giữ hay xóa — mặc định **giữ** để sửa nhanh).
- Nhớ mặc định lựa chọn **ít đổi**: "Ai trả khoản này" (và quỹ chi nếu có) từ lần trước, qua `localStorage`. Nội dung/số tiền để trống.

### Kỹ thuật
- Tiện ích nhỏ đọc/ghi `localStorage` an toàn (try/catch, key có version), không lưu dữ liệu nhạy cảm.
- Ghi giá trị "gần nhất" sau khi tạo phiếu thành công.

### Kiểm thử
- Phiếu thu: tạo 1 phiếu → mở lại modal thấy quỹ/danh mục/nội dung đã điền, số tiền trống.
- Phiếu chi: bấm "Tạo phiếu tương tự" → form điền đúng các trường nhân bản; "Ai trả" nhớ đúng lần trước.
- Quỹ/danh mục đã lưu bị xóa → không lỗi, không kẹt form.

---

## 4. Sửa lỗi font (mojibake) trong thông báo & giao diện

### Gốc rễ
Không phải lỗi đường truyền. Các chuỗi tiếng Việt bị hỏng encoding (mojibake, UTF-8 bị diễn giải sai) **nằm ngay trong file nguồn**. Ví dụ `src/app/api/de-xuat/route.js:298` ghi `'Phiáº¿u má»›i chá» duyá»‡t'` thay vì `'Phiếu mới chờ duyệt'`, trong khi nhánh dòng 305 lại đúng. Push gửi đi bytes đã hỏng → điện thoại hiện chữ lỗi.

### Phạm vi
4 file đã phát hiện có mojibake: `src/app/api/thu-chi/route.js`, `src/app/api/de-xuat/route.js`, `src/app/de-xuat/page.js`, `src/app/ncc/page.js`. Gồm cả comment lẫn chuỗi hiển thị/thông báo.

### Xử lý
- Quét toàn bộ `web-app/src` tìm ký tự mojibake (mẫu: `á»`, `Ä‘`, `â€`, `áº`, `Ã ...`).
- Sửa lại đúng tiếng Việt cho mọi chuỗi hiển thị & thông báo (ưu tiên chuỗi push/toast/nhãn UI; comment sửa luôn cho sạch).
- Đảm bảo file lưu UTF-8.
- Verify: `npm run build`; kiểm tra lại nội dung notify tạo phiếu (title "Phiếu mới chờ duyệt", body có "—" và "đ" hiển thị đúng).

### Phòng tái diễn
- Ghi chú trong `.claude/rules/coding-style.md` (hoặc CONTEXT.md): luôn lưu file UTF-8; cẩn thận khi mở/sửa bằng editor đặt sai encoding.

---

## Thứ tự triển khai đề xuất
1. **#4 (lỗi font)** — nhanh, rủi ro thấp, có lợi ngay.
2. **#2 (ô ngày)** — sửa 1 component dùng chung, ảnh hưởng rộng nhưng gọn.
3. **#3 (nhớ phiếu)** — thêm tiện ích localStorage + UI nhỏ.
4. **#1 (chọn tháng)** — lớn nhất, đụng nhiều API; làm sau cùng.

## Ngoài phạm vi (YAGNI)
- Không đổi công thức tài chính (giữ nguyên bất biến nguồn chi phí).
- Không thêm export/lịch sử thay đổi phiếu.
- Không đồng bộ "giá trị gần nhất" lên server (chỉ localStorage/thiết bị).
