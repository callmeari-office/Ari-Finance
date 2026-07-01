# Dashboard "Tổng quan" — Context & hướng dẫn mở rộng

> **Đọc file này TRƯỚC khi thêm/sửa bất kỳ widget, logic, hay dữ liệu nào trên màn hình Tổng quan.**
> Mục tiêu: tránh hiểu sai cấu trúc, giữ đúng thứ tự ưu tiên, không phá data-invariants.

- **Trang**: `src/app/page.js` (component `Dashboard`) — đây CHÍNH là route `/` (màn hình Tổng quan).
- **CSS**: `src/app/dashboard.module.css` (import là `styles`).
- **API gộp**: `src/app/api/dashboard/route.js` — 1 request duy nhất trả toàn bộ dữ liệu, **server tự kiểm tra quyền** và trả `null` cho phần không được xem.
- Cập nhật lớn gần nhất: **Đợt 33 (2026-06-29)** — reorder theo ưu tiên + tối ưu mobile (xem `CONTEXT.md`).

---

## 1. Luồng dữ liệu (rất quan trọng)

```
page.js  ──fetch──▶  /api/auth/me   (xác thực session, lấy user.role + permissions)
page.js  ──fetch──▶  /api/dashboard (1 lần, trả TẤT CẢ khối; null = không có quyền)
```

`fetchDashboard()` đổ dữ liệu vào state. Các key trả về từ `/api/dashboard`:

| Key | State | Dùng cho khối |
|---|---|---|
| `proposals` | `proposals` | Khối cá nhân (STAFF/LEADER) |
| `pendingPayment`, `pendingReimburse` | đếm nhẹ | Cần xử lý |
| `funds` | `funds` | Quỹ (fund strip) + KPI "Tiền đang có" |
| `thongKeThang` | `transactions` (rolling 6 tháng) | Biểu đồ Thu-Chi |
| `loiNhuan` | `profitMonths` | KPI sức khỏe + đường Lãi/Lỗ |
| `canhBao` | `canhBao` | Cần xử lý (nhắc hạn / vượt hạn mức / vượt KH) |
| `duBao` | `duBao` | Dự báo dòng tiền |
| `chiPhiDuKien` | `chiPhiDuKien` | Ước chi/lãi cả tháng (trong KPI) |
| `deXuatTheoNguoi` | `deXuatTheoNguoi` | Pipeline đề xuất theo người |
| `nganSach` | `nganSachThang` | Ngân sách danh mục (STAFF/LEADER) |
| `doanhThu` | `doanhThuSummary` | Doanh thu mini (STAFF/LEADER) |
| `thongBao` | `thongBaoList` | Bảng thông báo nội bộ |

> **Nguyên tắc**: thêm dữ liệu mới cho dashboard thì **thêm vào `/api/dashboard`** (kèm kiểm tra quyền ở server), KHÔNG tạo fetch riêng lẻ trên client trừ khi có lý do (tránh nhiều round-trip, giữ app nhẹ — xem `coding-style.md`).

---

## 2. Phân quyền widget (`tq*`)

Mỗi khối bật/tắt qua `canViewMenu(user, 'tq...')` (định nghĩa ở đầu render):

| Biến | Permission key | Khối | Vai trò điển hình |
|---|---|---|---|
| `canKPI` | `tqKPITaiChinh` | Sức khỏe tài chính (KPI) | OWNER/MANAGER |
| `canXuLy` | `tqCanXuLy` | Cần xử lý + Pipeline đề xuất | OWNER/MANAGER |
| `canQuy` | `tqQuy` | Quỹ (fund strip) | OWNER/MANAGER |
| `canXuHuong` | `tqXuHuong` | Biểu đồ Thu-Chi 6 tháng | OWNER/MANAGER |
| `canDuBao` | `tqDuBao` | Dự báo dòng tiền | OWNER/MANAGER |
| `canPersonal` | `tqDeXuatCuaToi` + `isRestrictedToOwnProposals(role)` | Khối cá nhân | STAFF/LEADER |
| `canNganSach` | `keHoachDBThang` (+canPersonal) | Ngân sách danh mục | STAFF/LEADER |
| `canDoanhThuMini` | `doanhThuDBThang` (+canPersonal) | Doanh thu mini | STAFF/LEADER |

> Thêm widget mới → cân nhắc tạo permission key `tq...` mới và gate bằng `canViewMenu`. Trang quản quyền: `/quyen`.

---

## 3. Thứ tự khối hiện tại (sau Đợt 33)

**Dùng chung (mọi vai trò):** Banner chào → Thẻ hành động STAFF/LEADER (chỉ `canPersonal`) → Bảng thông báo nội bộ.

**OWNER/MANAGER (theo độ ưu tiên — ĐỪNG đảo lộn nếu không có lý do):**

1. **Sức khỏe tài chính (KPI 4 thẻ)** `canKPI` — Doanh thu / Chi phí / Lãi-Lỗ / Tiền đang có. *Ưu tiên cao nhất → trên cùng.*
   - **Bộ chọn tháng `‹ Tháng M/YYYY ›`** (Đợt 35) ở tiêu đề khối. State `selectedMonth` (`YYYY-MM`) ở `page.js`. 3 thẻ đầu đổi theo `selMonthNum` — lấy **trực tiếp từ `profitMonths`** (đã là 12 tháng năm nay), KHÔNG gọi API mới. **"Tiền đang có" luôn hiện tại** (nhãn "· hiện tại"). Dòng dự báo (sắp tới hạn/ước cả tháng/lãi ước) chỉ hiện khi `isCurrentMonthSel`. Chặn tiến quá tháng này, lùi không quá `earliestDataMonth`. Chỉ trong năm nay (muốn năm trước → thêm fetch `nam`). Các widget STAFF/LEADER (Ngân sách/Doanh thu mini) và "Đề xuất theo người"/"Cảnh báo" GIỮ tháng hiện tại — không gắn selector.
2. **Cần xử lý** `canXuLy` — phiếu chờ duyệt + cảnh báo (nhắc hạn, vượt hạn mức, vượt KH).
3. **Quỹ — số dư từng nơi** `canQuy` — fund strip (đã bỏ Fund Hero; tổng nằm ở KPI).
4. **Dự báo dòng tiền** `canDuBao`.
5. **2 cột** (`.twoColRow`, desktop ≥1100px): **Biểu đồ Thu-Chi 6 tháng** `canXuHuong` | **Pipeline đề xuất theo người** `canXuLy && deXuatTheoNguoi`.

**STAFF/LEADER:** Khối cá nhân (4 thẻ) → Phiếu sắp đến hạn → Cần xem lại (bị từ chối) → Ngân sách danh mục → Doanh thu mini.

> Trong JSX, các khối còn comment đánh số cũ (❶❷❸❹...). **Số trong comment KHÔNG còn khớp thứ tự hiển thị** sau reorder — đừng tin số, hãy đọc guard `canXxx` và tiêu đề.

---

## 4. Quy ước layout & responsive (phải giữ)

- **Mobile-first, app nhẹ.** Cảnh báo trước khi thêm query nặng / chart phức tạp.
- **KPI**: desktop 4 cột → ≤1024px 2 cột → ≤768px **2×2** (`.dashboardGrid` media query). Số tiền KPI dùng `fmtKpi` = `isCompact ? formatVNDShort : formatVND`; `isCompact` bật khi `max-width:768px` (matchMedia). Tooltip/desktop luôn hiện số đầy đủ.
- **2 cột** Biểu đồ + Pipeline: `.twoColRow` chỉ 2 cột từ **≥1100px**, dưới đó xếp dọc (tránh tràn ngang). Khi bọc thêm card vào `.twoColRow`, **KHÔNG dùng `.largeCard`** (class đó set `grid-column: span 4`, phá lưới 2 cột).
- **Fund strip**: sắp xếp ở JS — quỹ có tiền (giảm dần) → quỹ âm (đỏ `.fundChipNeg`) → quỹ 0đ làm mờ `.fundChipZero` (opacity .5) xuống cuối. **Không ẩn hẳn quỹ 0đ.** Strip cuộn ngang trên mobile.

---

## 5. Data invariants — KHÔNG được phá

Xem chi tiết `.claude/rules/data-sources.md`. Tóm tắt:

- "Chi phí thực tế" = **ThuChi(CHI)** + **DeXuatChiPhi(laLichSu=true)** — luôn dùng cả 2 nguồn.
- **Doanh thu** chỉ lấy từ `KeHoachDoanhThu.thucTe`.
- Đừng tự suy ra chi phí từ một nguồn đơn lẻ. Mọi KPI/biểu đồ/cảnh báo trên dashboard phải đi qua đúng API trong bảng đó.

## 6. Theme — KHÔNG hardcode màu

Xem `.claude/rules/coding-style.md` mục Theme. App chạy 3 theme (light/dark/pink "Chế độ Ari").
- Dùng `var(--success/--danger/--warning/--info)` + bản `--*-bg`; nền mờ `rgba(var(--brand-brown-rgb), x)` hoặc `var(--border)`.
- Cấm tint trắng `rgba(255,255,255,x)` (vô hình trên light).
- Ngoại lệ có chủ ý (đừng "sửa"): ternary traffic-light trong JS (`pct>=100?'#ef4444':...`), chip nền đậm chữ trắng, palette chart, `stroke=/fill=` trong SVG, overlay modal `rgba(0,0,0,0.5)`.

---

## 7. Checklist thêm 1 widget/logic mới vào Tổng quan

1. **Dữ liệu**: thêm key vào `/api/dashboard/route.js`, kiểm tra quyền ở server, trả `null` nếu không được xem. Tôn trọng data-invariants (mục 5).
2. **Quyền**: tạo `tq...` key (nếu cần) + gate bằng `canViewMenu(user, 'tq...')`.
3. **State + đổ dữ liệu** trong `fetchDashboard()` (kèm cờ loading + skeleton).
4. **Render** khối có điều kiện, đặt đúng vị trí ưu tiên (mục 3).
5. **Responsive**: kiểm tra mobile (2×2 / cuộn ngang / rút gọn tr-k), không tràn ngang.
6. **Màu**: dùng design tokens, không hardcode (mục 6).
7. **Verify**: `npm run build` (KHÔNG dùng `npm run lint` — ESLint lỗi môi trường). Sau `prisma generate` phải restart dev server.
8. **Tài liệu**: cập nhật `CONTEXT.md` (thêm "Đợt N") và file này nếu đổi cấu trúc/thứ tự.

## 8. Gotcha

- `npm run dev` dùng `--webpack` và **chỉ cho 1 server**; nếu báo "Another next dev server is already running" nghĩa là đã có server ở :3000 — chỉ cần refresh.
- CSS `.fundHero*` hiện là **dead code** (đã bỏ Fund Hero ở Đợt 33) — có thể xóa khi dọn dẹp.
- `formatVND` (đầy đủ) vs `formatVNDShort` (tr/k) vs `fmtKpi` (tự chọn theo `isCompact`): dùng `fmtKpi` cho số lớn ở thẻ KPI; tooltip giữ `formatVND`.
