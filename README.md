# ARI Finance — Quản lý tài chính nội bộ

Ứng dụng quản lý tài chính nội bộ cho shop **Call Me Ari**: đề xuất chi phí, duyệt thanh toán, theo dõi thu-chi, kế hoạch chi phí / doanh thu, lợi nhuận và nhân sự.

- **Production:** https://callmeari-finance.vercel.app/
- **Repo:** https://github.com/callmeari-office/Ari-Finance

## Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router) |
| ORM | Prisma 7 |
| Database | Supabase (PostgreSQL) |
| Auth | Session cookie (bcryptjs) |
| Email | Nodemailer + Gmail App Password |
| UI | CSS Modules + CSS variables (Dark/Light mode) |
| PWA | next-pwa (cài lên điện thoại) |

## Cách chạy

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file .env (xem bên dưới)

# 3. Chạy development server
npx next dev
```

Mở [http://localhost:3000](http://localhost:3000) trên trình duyệt.

## Biến môi trường (.env)

```env
DATABASE_URL=postgresql://...        # Supabase connection string
DIRECT_URL=postgresql://...          # Supabase direct URL (cho Prisma migrate)
APP_URL=http://localhost:3000        # URL app (dùng trong email link)

SMTP_USER=your@gmail.com             # Gmail gửi email
SMTP_PASS=xxxx xxxx xxxx xxxx        # Google App Password (16 ký tự)
SMTP_FROM=ARI Finance <your@gmail.com>
```

## Migrations (lần đầu hoặc cập nhật DB)

```bash
# Tạo bảng lịch sử thao tác
node prisma/add-lichsuthaotac.js

# Tạo bảng token đặt lại mật khẩu
node prisma/add-password-reset.js

# Tạo bảng phiếu chi định kỳ
node prisma/add-phieu-dinh-ky.js

# Tái sinh Prisma Client sau khi cập nhật schema
npx prisma generate
```

## Build (kiểm tra trước khi deploy)

```bash
npx next build --no-lint
```

> Lưu ý: không dùng `--lint` (bị lỗi scopeManager với version eslint hiện tại).

## Tính năng chính

- **Đề xuất chi phí**: tạo phiếu, duyệt, hủy, tìm kiếm, xuất Excel
- **Chi phí định kỳ**: mẫu phiếu tái diễn hàng tháng (tự động tạo phiếu)
- **Thu-chi**: ghi nhận giao dịch, theo dõi số dư quỹ
- **Kế hoạch chi phí & doanh thu**: so sánh kế hoạch vs thực tế theo kênh bán
- **Lợi nhuận**: dashboard lãi/lỗ tháng, sức khỏe tài chính
- **Nhân sự**: quản lý tài khoản, đặt lại mật khẩu qua email
- **Nhật ký hệ thống**: audit log mọi thao tác
- **Dark mode + PWA**: cài được lên điện thoại
