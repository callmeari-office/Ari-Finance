# Prompt: Cải thiện hệ thống thông báo ARI Finance

> Copy toàn bộ nội dung này vào đầu session mới.

---

Tôi cần bạn triển khai kế hoạch cải thiện hệ thống thông báo cho ARI Finance webapp.

**Đọc trước khi làm:**
- `CONTEXT.md` — trạng thái dự án hiện tại
- `web-app/docs/plans/2026-06-29-notification-improvements.md` — plan chi tiết 7 việc với code cụ thể

**Tóm tắt 7 việc (chi tiết code trong file plan):**

1. **Bell panel** — thêm render `vuotHanMuc[]` + `vuotKeHoach[]` từ `/api/canh-bao` vào notification panel (`Sidebar.js`); cộng vào `bellBadge`; `bellRed = true` khi có vuotHanMuc. Đọc shape thực của 2 mảng này từ `getCanhBao` trong `dashboardQueries.js` trước khi render.

2. **Read status (localStorage)** — đánh dấu ThongBaoNoiBo đã đọc khi mở panel; badge chỉ đếm chưa đọc; hiện dot xanh nhỏ trên item chưa đọc. Dùng `localStorage` key `ari-seen-tb-{userId}` (không cần DB migration).

3. **Anti-spam push** — đổi `tag: 'phieu-' + id` → `tag: 'new-proposals'` (fixed) trong `api/de-xuat/route.js`. Thêm push vào `api/de-xuat/bulk/route.js` (hiện không có). Mục tiêu: notification mới replace cái cũ thay vì chồng.

4. **Import Excel push** — thêm `pushNotifyManagers` vào `api/de-xuat/import-de-xuat/route.js` sau khi tạo phiếu (hiện chỉ gửi email đang TẮT, không có push).

5. **CHO_HOAN_UNG push** — mở rộng điều kiện trong `api/de-xuat/route.js` để push khi phiếu mới có trạng thái `CHO_HOAN_UNG` (hiện chỉ có `CHO_THANH_TOAN`).

6. **Fix approverId** — sửa `notifyProposalApproved(creatorId, payload)` trong `webpush.js` thêm tham số `approverId = null`; truyền `user.id` vào 3 route gọi hàm này (`de-xuat/[id]`, `de-xuat/duyet-nhieu`, `de-xuat/duyet-gop`) để người duyệt không tự nhận push "đã duyệt".

7. **Visibilitychange** — thêm `document.addEventListener('visibilitychange', ...)` trong `Sidebar.js` để bell refresh ngay khi user tab back vào app.

**Thứ tự thực hiện:** 6 → 3+4+5 → 7 → 1 → 2. Verify `npm run build` pass sau mỗi nhóm.

**Lưu ý:**
- Mọi push call phải bọc `.catch(() => {})` hoặc try/catch riêng — không để lỗi push ảnh hưởng luồng nghiệp vụ.
- Không cần DB migration trong toàn bộ scope này.
- Giữ nguyên quy tắc màu trong `coding-style.md` khi thêm UI vào bell panel.
- Sau khi xong, cập nhật `CONTEXT.md` thêm mục mô tả đợt này.
