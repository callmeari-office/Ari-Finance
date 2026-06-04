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
- Tài khoản test: owner/owner123, manager/manager123, staff/staff123.

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
- **Prisma 7 `db push` không ổn định trên Windows** — kiểm tra kỹ khi migrate schema.
- Tên thư mục/route dùng **tiếng Việt không dấu, có gạch nối**: `de-xuat`, `thu-chi`, `ke-hoach`, `doanh-thu`, `nhan-su`, `cau-hinh`.
- Mã phiếu tự sinh dạng `CP-/TC-/NCC-YYMMDD-xxxx` (`src/lib/generateId.js`).
- Phân quyền 2 lớp: role mặc định (Sidebar) + `permissions` override (trang `/quyen`).
