# Chi phí theo người đề xuất — 2 dashboard

> Ngày: 2026-06-29. Trạng thái: đã duyệt thiết kế, đang triển khai.

## Mục tiêu
Cho Owner/Manager thấy nhanh: ai đã chi bao nhiêu (thực tế) và ai đang đề xuất/treo bao nhiêu (pipeline duyệt). Hai góc nhìn ở hai trang khác nhau, tránh trùng số gây rối.

## Sự thật dữ liệu (lifecycle đề xuất)
Trạng thái `DeXuatChiPhi`: `CHO_THANH_TOAN`, `CHO_HOAN_UNG`, `DA_THANH_TOAN`, `HUY`. Không có state "chờ duyệt" riêng — bước "Duyệt" = gán quỹ + sinh `ThuChi`.
- **Đã duyệt & chi thật** = `DA_THANH_TOAN` AND `thuChiId != null`.
- **Chờ duyệt** = `CHO_THANH_TOAN` + `CHO_HOAN_UNG` + "thanh toán sẵn" (`DA_THANH_TOAN` & `thuChiId = null`).
- `laLichSu` = data cũ import, không qua workflow.

## Dashboard ① — Báo cáo Thu-Chi: "Chi phí theo người đề xuất"
Là **chi thực tế**, chia nhỏ ĐÚNG tổng chi đang có của báo cáo theo người (sum = tổng chi, không sinh số lạ).
- Nguồn: dùng lại `allData` trong `/api/thu-chi?includeHistory=true` (ThuChi CHI + DeXuatChiPhi laLichSu).
- Quy tắc gán người:
  - `ThuChi(CHI)` có đề xuất gắn → phân bổ `ThuChi.soTien` cho người tạo từng đề xuất (tỷ lệ theo `soTien` đề xuất, xử lý duyệt-gộp nhiều người).
  - `ThuChi(CHI)` không có đề xuất → "Không xác định".
  - `DeXuatChiPhi(laLichSu)` → "Không xác định".
- Dùng chung filter kỳ của trang. Hiển thị cho mọi vai trò xem được báo cáo.
- Sắp xếp theo số tiền giảm dần; "Không xác định" luôn ở cuối.
- API trả thêm `stats.sortedChiNguoi: [{ id, name, amount, count }]`.

## Dashboard ② — Tổng quan: widget "Đề xuất theo người"
Pipeline duyệt — chỉ **Owner/Manager** (gate theo quyền `tqCanXuLy`).
- Phạm vi: `ngayPhatSinh` trong tháng hiện tại, cả 2 nhóm.
- Mỗi người: thanh stacked `[🟢 đã duyệt | 🟡 chờ duyệt]` + số tiền chờ + số tiền đã + số phiếu.
- Loại trừ `HUY` và `laLichSu`.
- Sắp xếp theo tiền **chờ duyệt** giảm dần.
- Cảnh báo tồn đọng: phiếu chờ duyệt `ngayPhatSinh < đầu tháng này` → dòng "còn N phiếu… X đ".
- Footer: tổng chờ duyệt + nút "Đi duyệt →" → `/de-xuat/duyet`.
- Data qua `/api/dashboard` (field `deXuatTheoNguoi`), helper `getDeXuatTheoNguoiThang` trong `dashboardQueries.js`.

## File thay đổi
- `src/lib/avatar.js` (mới) — `getInitials`, `getAvatarColor` (palette cố định, hợp 3 theme).
- `src/lib/dashboardQueries.js` — thêm `getDeXuatTheoNguoiThang`.
- `src/app/api/dashboard/route.js` — wire field `deXuatTheoNguoi`, gate `tqCanXuLy`.
- `src/app/api/thu-chi/route.js` — thêm `sortedChiNguoi` vào stats; bổ sung `nguoiTao.id` vào select đề xuất.
- `src/app/page.js` — widget Tổng quan.
- `src/app/bao-cao/page.js` — section báo cáo.

## Bất biến tôn trọng
- Không hardcode màu vi phạm theme (avatar chip là ngoại lệ có chủ ý: nền pastel + chữ đậm cùng tông).
- Mobile-first, query nhẹ (group-by JS trên tập nhỏ).
- Không double-count: tổng `sortedChiNguoi` = `tongChi` của báo cáo.
