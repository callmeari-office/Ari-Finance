# Spec — Trang "Hướng dẫn sử dụng" (/huong-dan)

> Ngày: 2026-06-15 · Dự án: ARI Finance (web-app) · Loại: tính năng UI thuần (không đụng API/DB/auth)

## 1. Mục tiêu
Cung cấp một trang hướng dẫn trong app để người mới — đặc biệt nhân viên không rành công nghệ — đọc là biết thao tác. Bổ trợ cho tour Onboarding 4 bước (chào hỏi nhanh lần đầu); trang này là **nơi tra cứu** chi tiết, vào lại bất cứ lúc nào.

Nguyên tắc: gọn, ấm áp giọng Ari, nhẹ (mobile-first), đúng cả 3 theme (light/dark/pink).

## 2. Phạm vi

### Có làm
- Route mới `/huong-dan` — trang tĩnh, nội dung viết thẳng trong JSX, **đổi theo vai trò** (Phương án A đã chốt).
- Menu Sidebar mới "Hướng dẫn sử dụng" (icon `BookOpen`), **mọi vai trò** thấy.
- Nút "Xem lại tour chào mừng" trên đầu trang → phát `CustomEvent('ari:show-onboarding')` (đã có sẵn cơ chế trong `Onboarding.js`).
- Bỏ nút "Xem lại hướng dẫn" ở footer Sidebar (đã thêm ở Đợt 18) — menu mới + nút trên trang thay thế, tránh trùng lặp.

### KHÔNG làm (đã chốt loại bỏ)
- Từ điển thuật ngữ riêng / FAQ / Thông tin app — người dùng đã chọn bỏ (giải nghĩa thuật ngữ đã có sẵn qua nút "?" `HelpTip` trong form).
- Nội dung sửa được trong app (DB-backed) — quá nặng (YAGNI).
- Ảnh chụp màn hình bắt buộc — chỉ chừa "ô chứa ảnh" tùy chọn để thêm sau.

## 3. Cấu trúc nội dung (3 mục, role-aware)

**Mục 1 — Bắt đầu nhanh** *(mọi vai trò)*
- Sơ đồ 3 bước: Đăng nhập → Tạo phiếu chi → Theo dõi phiếu.
- 1–2 câu trấn an giọng Ari.

**Mục 2 — Cách tạo đề xuất & hiểu trạng thái phiếu** *(mọi vai trò — cốt lõi cho nhân viên)*
- Các bước tạo phiếu: ① Chọn "Ai trả khoản này?" → ② Danh mục, số tiền, nội dung → ③ Xác nhận & gửi.
- **Khối "Ai trả khoản này?"** (theo ý bổ sung của chủ shop): giải thích 3 lựa chọn và luồng/trạng thái tương ứng:
  - **Shop trả** → phiếu *Chờ thanh toán* → quản lý duyệt → *Đã chi*.
  - **Shop đã trả rồi** → ghi nhận *Đã thanh toán sẵn* → quản lý duyệt.
  - **Mình ứng trước** → phiếu *Chờ hoàn ứng* → quản lý duyệt → *Đã hoàn ứng cho bạn*.
- Sơ đồ luồng trạng thái: Đã gửi → Chờ duyệt → Đã duyệt → Đã chi / Đã hoàn ứng (đồng bộ ngôn ngữ với timeline trong modal chi tiết phiếu).
- Lưu ý ngắn: không sợ bấm sai (luôn có xác nhận), ảnh hóa đơn nên chụp rõ.
- 1 "ô chứa ảnh" tùy chọn (placeholder) cho screenshot form thật.

**Mục 3 — Duyệt phiếu & xem báo cáo** *(chỉ OWNER/MANAGER)*
- Cách duyệt phiếu chờ thanh toán, xem số dư quỹ, đọc báo cáo lãi/lỗ.
- Ẩn hoàn toàn với STAFF/LEADER (kiểm tra `user.role`).

## 4. Thiết kế kỹ thuật

### File mới
- `src/app/huong-dan/page.js` — `'use client'`; fetch `/api/auth/me` lấy `user` (theo mẫu các trang khác), redirect `/login` nếu 401; render Sidebar + nội dung theo vai trò.
- `src/app/huong-dan/huong-dan.module.css` — style trang, dùng token (`glass-card`, biến CSS, shadow/easing token). Không hardcode màu theme.

### File sửa
- `src/components/Sidebar.js`:
  - Thêm item `{ key: 'huongDan', name: 'Hướng dẫn sử dụng', path: '/huong-dan', icon: BookOpen }` vào `menuItems`.
  - Bỏ nút "Xem lại hướng dẫn" ở footer (giữ `HelpCircle` import nếu còn dùng chỗ khác, nếu không thì gỡ).
- `src/lib/roles.js`:
  - Cho `huongDan` hiển thị **mọi vai trò**: thêm vào `DEFAULT_MENU_ROLES` với đủ 4 role (`OWNER/MANAGER/LEADER/STAFF`). `canViewMenu` giữ nguyên cơ chế (permissions override vẫn áp dụng nếu chủ shop muốn tắt sau).

### Minh họa (SVG, theme-safe)
- Sơ đồ vẽ bằng SVG inline, **dùng `currentColor`** cho nét/chữ để tự đổi theo theme; chip trạng thái dùng biến semantic `var(--success/--warning/--info)` + nền `var(--*-bg)`.
- Icon: `lucide-react` (LogIn, FilePlus2, Bell, CheckSquare, BarChart3, BookOpen...).
- "Ô chứa ảnh": khối `border: 1.5px dashed var(--border)` + icon + chữ "Ảnh minh họa (tùy chọn)". v1 để trống; sau này bỏ ảnh vào `public/huong-dan/` và trỏ `<img>`.

### Tuân thủ quy tắc dự án (CLAUDE.md mục 3)
- Không hardcode màu theme; không dùng tint trắng `rgba(255,255,255,x)`.
- SVG presentation attr được phép dùng hex/`currentColor` (ngoại lệ có chủ ý).
- Mobile-first; vùng chạm thoải mái; tôn trọng `prefers-reduced-motion`.

## 5. Bố cục hiển thị
- Desktop: cột nội dung max ~900px, các mục là `glass-card` xếp dọc, khoảng cách thoáng. (Tùy chọn: hàng "mục lục" anchor ở đầu — chỉ thêm nếu không làm nặng; mặc định bỏ cho gọn.)
- Mobile: các card xếp dọc full-width; sơ đồ 3 bước xuống dạng dọc nếu chật.
- Đầu trang: tiêu đề "Hướng dẫn sử dụng" + mô tả 1 dòng + nút "Xem lại tour chào mừng".

## 6. Kiểm thử / nghiệm thu
- `npm run build` pass (không tăng lỗi; trang mới prerender tĩnh được).
- Kiểm tay 3 theme: light/dark/pink — màu sơ đồ & chip đọc tốt, không mất chữ.
- Kiểm vai trò: STAFF/LEADER **không** thấy Mục 3; OWNER/MANAGER thấy đủ 3 mục.
- Menu "Hướng dẫn sử dụng" hiện với mọi vai trò; bấm vào ra đúng trang.
- Nút "Xem lại tour" mở lại Onboarding từ bước 0.
- Footer Sidebar không còn nút "Xem lại hướng dẫn" trùng lặp.

## 7. Rủi ro / lưu ý
- Thêm `huongDan` vào `DEFAULT_MENU_ROLES`: cần kiểm trang `/quyen` không vỡ khi xuất hiện key mới (key mới chỉ thêm tùy chọn toggle; nếu chưa xử lý hiển thị ở /quyen thì menu vẫn theo mặc định — chấp nhận được, không bắt buộc thêm toggle ở /quyen trong phạm vi này).
- Không đụng logic nghiệp vụ: trang chỉ đọc `user.role`, không gọi API dữ liệu tài chính.
- Nội dung viết tay → khi UI/luồng đổi nhiều trong tương lai cần cập nhật chữ (chấp nhận được; nhẹ).

## 8. Ngoài phạm vi / để sau
- Ảnh chụp màn hình thật (thêm vào ô chứa ảnh khi cần).
- Toggle quyền cho menu Hướng dẫn ở trang `/quyen` (nếu sau này chủ shop muốn ẩn với vai trò nào đó).
