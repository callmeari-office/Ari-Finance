# Nhật ký Migration — ARI Finance

> **Quy tắc vàng (đọc khi đổi `schema.prisma`):**
> Mỗi lần thêm/đổi cột trong `schema.prisma` BẮT BUỘC làm đủ 3 bước, nếu thiếu bước 2 → app trắng trang / mất data:
> 1. `npx prisma generate` rồi **restart dev server** (Turbopack cache client cũ).
> 2. **Chạy SQL tương ứng lên DB**: `npx prisma db execute --file ./prisma/<ten-file>.sql`
>    (Prisma 7 `db push` không ổn định trên Windows — luôn dùng `db execute`.)
> 3. Ghi 1 dòng vào bảng dưới đây, rồi verify: `npm run db:check`.
>
> **Kiểm tra bất cứ lúc nào DB có khớp schema không:** `npm run db:check` (read-only, an toàn).

## Đã áp dụng

| Ngày | File | Nội dung | Trạng thái |
|---|---|---|---|
| 2026-06-15 | `update_ncc_permissions.sql` | Thêm cột `NhaCungCap.loaiDoiTuong` (default 'NCC') + bật quyền `ncc` cho STAFF/LEADER | ✅ Đã chạy |
| 2026-06-13 | `add-session-indexes.sql` | Index cho bảng Session | ✅ |
| 2026-06-13 | `migrate-anh-storage.js` | Chuyển ảnh hóa đơn sang Supabase Storage | ✅ |
| 2026-06-13 | `add-login-attempt.sql` | Bảng LoginAttempt (chống brute-force) | ✅ |
| 2026-06-08 | `add-thong-bao.js` | Bảng ThongBaoNoiBo | ✅ |
| 2026-06-06 | `add-push-subscription.sql` | Bảng PushSubscription (Web Push) | ✅ |
| 2026-06-05 | `add-password-reset.js` | Bảng PasswordResetToken | ✅ |
| 2026-06-05 | `add-phieu-dinh-ky.js` | Bảng PhieuDinhKy | ✅ |
| 2026-06-05 | `add-indexes.js` | Index hiệu năng | ✅ |
| 2026-06-04 | `add-lichsuthaotac.js` | Bảng LichSuThaoTac (audit log) | ✅ |
| 2026-06-02 | `add-lalichsu.js` | Cột `DeXuatChiPhi.laLichSu` | ✅ |
| 2026-06-02 | `migrate-ids.js` | Chuẩn hóa mã phiếu CP-/TC-/NCC- | ✅ |

## Tiện ích (KHÔNG phải migration — đừng auto-chạy)

| File | Mục đích |
|---|---|
| `seed.js` | Seed dữ liệu test (`npx prisma db seed`) |
| `reset-test-data.sql` | ⚠️ **XÓA dữ liệu test** — chỉ chạy thủ công khi cố ý reset |
