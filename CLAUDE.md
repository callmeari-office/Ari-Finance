# CLAUDE.md — ARI-Finance (web-app)

@AGENTS.md
> ⚠️ Next.js 16 có breaking changes — đọc `node_modules/next/dist/docs/` trước khi code.

App quản lý tài chính nội bộ shop **Call Me Ari**: đề xuất chi phí → duyệt → sinh phiếu thu-chi + số dư quỹ, kèm kế hoạch ngân sách, doanh thu, báo cáo. Bối cảnh đầy đủ: `../CONTEXT.md`.

## 1. Build & Run
Chạy trong `web-app/` (Windows + PowerShell):
- `npm run dev` — dev server → http://localhost:3000
- `npm run build` / `npm start` — production
- `npm run lint` — ESLint
- `npx prisma generate` — sinh client (tự chạy postinstall)
- `npx prisma db seed` — seed dữ liệu (`prisma/seed.js`)
- Tài khoản test: owner/owner123, namnnb/123456 (manager), linhnnt/123456 (manager), namnnb2/123456 (staff), test/123456 (leader).

## 2. Tech stack & coding style
- **JavaScript thuần, KHÔNG TypeScript** (chủ shop không phải dev → ưu tiên đơn giản).
- Next.js 16 (App Router, Turbopack) + React 19. Code trong `src/app/` (pages + `api/` route handlers), `src/components/`, `src/lib/`.
- Tailwind CSS v4 + CSS Modules + class global `glass-card`, `custom-table`. Icons: `lucide-react`.
- DB: PostgreSQL (Supabase) qua **Prisma 7 + adapter `@prisma/adapter-pg` + Pool `pg`**. Schema: `prisma/schema.prisma`.
- Auth: session tự build (cookie HTTP-only `session_token`, TTL **30 ngày sliding** — auto-gia hạn mỗi request), hash `bcryptjs`. Không dùng NextAuth.
- **Mobile-first, giữ app nhẹ** — cảnh báo trước khi thêm tính năng nặng (heavy query, chart phức tạp); nén ảnh hóa đơn client-side → WebP.

## 3. Lưu ý kỹ thuật quan trọng
- **SSL Supabase bắt buộc**: `src/lib/prisma.js` phải dùng `ssl: { rejectUnauthorized: false }`. Đổi thành `ssl: false` → lỗi 404 API. Đừng sửa nhầm.
- Prisma client là **singleton trên `globalThis`** (tránh nhiều connection khi hot-reload).
- **Prisma 7 `db push` không ổn định trên Windows** — kiểm tra kỹ khi migrate schema. Thêm cột mới dùng `npx prisma db execute --file ./prisma/ten-file.sql` (KHÔNG có flag `--schema` — Prisma 7 đọc từ `prisma.config.ts` tự động).
- **Sau `prisma generate` PHẢI restart dev server** — Turbopack cache Prisma client cũ trong RAM, gọi cột mới sẽ trả `undefined` hoặc 500. Luôn kill process rồi `npm run dev` lại.
- Tên thư mục/route dùng **tiếng Việt không dấu, có gạch nối**: `de-xuat`, `thu-chi`, `ke-hoach`, `doanh-thu`, `nhan-su`, `cau-hinh`.
- Mã phiếu tự sinh dạng `CP-/TC-/NCC-YYMMDD-xxxx` (`src/lib/generateId.js`).
- Phân quyền 2 lớp: role mặc định (Sidebar) + `permissions` override (trang `/quyen`).
- **KHÔNG hardcode màu tối** (rgba đen, `#1d2030`...) trong CSS — app chạy cả light/dark mode. Dùng biến CSS: `var(--surface)`, `var(--text-main)`, `var(--text-muted)`, `var(--border)`, `var(--brand-brown)`.
- **ESLint 10** trong repo lỗi môi trường `scopeManager.addGlobals is not a function` — đây là bug version, không liên quan code. Dùng `next build` để verify thay vì `npm run lint`.

## 4. Trạng thái dự án — 2026-06-06
Cập nhật cuối: **2026-06-06 (Đợt 7)**.

### Tính năng mới hôm nay (2026-06-06)
- **Chế độ Ari theme thời trang độc quyền & Web Push & Vercel Crons**:
  - Giao diện theme màu hồng ("Chế độ Ari") cao cấp với font Quicksand, viền đứt couture stitch, button satin cát, hiệu ứng cánh hoa bay `PetalsTransition.js`.
  - Tích hợp Web Push Notifications cho trình duyệt và Service Worker.
  - Cấu hình file `vercel.json` lên lịch tự động cho các API cron gửi báo cáo mail tháng và push thông báo đẩy hàng ngày.
  - Cấu hình đồng bộ 10 biến môi trường (SMTP, VAPID, CRON_SECRET, APP_URL) lên Vercel Production và cập nhật tên miền chính thành `https://callmeari-finance.vercel.app/`.

### Tính năng cũ hơn (2026-06-05)
- **Trang Thông tin Quỹ (`/quy`) nâng cấp toàn diện:**
  - Lazy-load 8 phiếu gần nhất per quỹ (không còn tải 100 phiếu toàn cục khi vào trang)
  - Badge "X phiếu" lấy số thật từ server (trước đếm trong 100 phiếu → sai)
  - KPI dòng tiền VÀO/RA theo kỳ: Tháng này / Năm nay / Tất cả (`/api/quy/cashflow?ky=`)
  - Cảnh báo quỹ âm (banner + tô đỏ dòng), thanh tỷ trọng %, banner tiền NV đang ứng
  - Card view mobile (bảng 10 cột → thẻ trên ≤768px)
  - **(E) Điều chỉnh số dư thủ công** (OWNER): cột `Quy.soDuDieuChinh`, modal nhập số thực tế → `/api/quy/[id]/dieu-chinh`, KHÔNG tạo phiếu thu-chi, ghi nhật ký `DIEU_CHINH`
  - "Xem tất cả" → `/thu-chi?quyId=X` (trang Thu-Chi tự đọc URL, set filter + bỏ lọc tháng)
- **Fix:** vùng expand phiếu chi dùng `var(--surface)` thay nền tối hardcode → đúng ở cả light/dark mode

### Files sửa hôm nay
| File | Thay đổi |
|---|---|
| `prisma/schema.prisma` | Thêm `soDuDieuChinh Float @default(0)` vào model `Quy` |
| `src/app/api/quy/route.js` | GET thêm `soPhieu`, `soDuDieuChinh` |
| `src/app/api/quy/cashflow/route.js` | **MỚI** — KPI dòng tiền theo kỳ + tienDangUng |
| `src/app/api/quy/[id]/dieu-chinh/route.js` | **MỚI** — POST điều chỉnh số dư |
| `src/app/quy/page.js` | Viết lại toàn bộ |
| `src/app/quy/quy.module.css` | Thêm CSS: kyBar, detailBox, fundCard, modal, compBar... |
| `src/app/thu-chi/page.js` | Thêm useEffect đọc `?quyId` từ URL |
