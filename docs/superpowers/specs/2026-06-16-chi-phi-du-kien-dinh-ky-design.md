# Spec — Chi phí dự kiến & Tự động hóa phiếu định kỳ

> Ngày: 2026-06-16. Trạng thái: **chờ review** → plan → implement.
> Bối cảnh: `CONTEXT.md`, invariant nguồn chi `CLAUDE.md` §4.

## 1. Vấn đề

Giữa tháng, các con số tài chính bị méo vì app ghi chi phí theo **tiền mặt thực chi**
(invariant §4: chỉ `ThuChi(CHI)` + `DeXuatChiPhi(laLichSu=true)`). Các khoản **cố định**
(lương, thuê mặt bằng, lãi vay, internet, phần mềm) phát sinh dần trong tháng nhưng chỉ
được ghi khi tiền thực ra khỏi quỹ — thường trễ. Hệ quả ngày 16/6:

- "Chi phí tháng này" thiếu (lương/thuê chưa nhập).
- "Lãi tháng này" **ảo cao** vì chi phí thiếu.
- Email "Báo cáo sáng" nhận định lạc quan sai ("đang lời 97tr").

Phần **Dự báo dòng tiền** (`getDuBao`) đã đúng hướng — nó cộng cả phiếu chờ thanh toán
lẫn chiếu bóng `PhieuDinhKy`. Vấn đề nằm ở **KPI "đã chi / lãi" và đoạn nhận định AI** vốn
thuần tiền mặt, nhìn quá khứ.

## 2. Nguyên tắc

**Không đụng invariant §4.** "Đã chi thực tế" vẫn thuần tiền mặt. Mọi thứ "dự kiến" là
**lớp phủ phái sinh** tính từ phiếu chưa trả — không ghi đè con số gốc, không tạo nguồn dữ
liệu chi phí mới.

## 3. Quyết định đã chốt (qua brainstorm)

| Vấn đề | Quyết định |
|---|---|
| Cơ chế ghi nhận khoản cố định | **Auto tạo phiếu thật đầu tháng** từ mẫu `PhieuDinhKy` |
| Trigger | **Cron tự chạy ngày 1** + **giữ nút "Tạo tháng này"** thủ công |
| Công thức "dự kiến cả tháng" | **Đã chi + khoản cố định còn lại** (chỉ khoản chắc chắn, không ước biến động) |
| Hiển thị | **Cả 4 nơi**: thẻ Chi phí, thẻ Lãi (lãi ước cả tháng), Báo cáo, Email |
| Khối Báo cáo | **Gộp theo danh mục** (gọn cho mobile), không liệt kê từng phiếu |

## 4. Thiết kế chi tiết

### 4.1 Mẫu định kỳ — không đổi schema
`PhieuDinhKy` đã đủ: `tenMau`, `noiDung`, `soTien`, `danhMucId`, `nhaCungCapId?`,
`nguonTien`, `trangThaiMacDinh` (default `CHO_THANH_TOAN`), `ngayChiTrongThang` (1–28),
`active`. Người dùng khai mỗi khoản cố định một mẫu, đặt **đúng ngày thật** (lương ngày 5,
thuê ngày 1, lãi vay ngày 10…) để dự báo đặt khoản chi đúng thời điểm. **Không cần migrate.**

### 4.2 Tách logic tạo phiếu định kỳ thành hàm dùng chung
- Hiện logic nằm trong `POST /api/dinh-ky/tao-thang-nay/route.js`.
- **Tách ra** `src/lib/dinhKy.js` → `export async function taoPhieuDinhKyChoThang(prisma, { nam, thang, nguoiTaoId })`.
  Trả `{ created: [{id, trangThai}], skipped: [tenMau] }`. Giữ nguyên 100% logic:
  chống trùng (skip nếu đã có phiếu cùng `noiDung + danhMucId` trong tháng, `trangThai != HUY`),
  `ngayPhatSinh = ngayCanThanhToan = ngayChiTrongThang` (kẹp theo số ngày của tháng), sinh
  `maPhieu` tuần tự, ghi nhật ký `TAO/DE_XUAT`.
- Route `tao-thang-nay` đổi ruột sang gọi hàm này (response shape giữ nguyên). Email
  `notifyManagersBulkChoThanhToan` cho các phiếu `CHO_THANH_TOAN` giữ nguyên trong route
  (không nhét vào lib để lib thuần dữ liệu).

### 4.3 Cron tự chạy ngày 1 — `GET /api/cron/dinh-ky`
- Theo mẫu `cron/thu-thang`: check `Authorization: Bearer <CRON_SECRET>`; luôn trả 200
  với JSON `{ created, skipped }`. Hỗ trợ `?preview=true` (session OWNER, **không tạo gì**,
  chỉ trả danh sách mẫu active sẽ tạo) để test.
- Tạo cho **tháng hiện tại** (`now`). Gọi `taoPhieuDinhKyChoThang`. Gửi email bulk +
  1 Web Push tới OWNER/MANAGER: "Đã tạo N phiếu định kỳ tháng X" (bọc try/catch riêng,
  lỗi push/email không làm hỏng việc tạo phiếu).
- **Lịch:** `0 1 1 * *` (8:00 VN ngày 1).
- **Slot cron Vercel (rủi ro):** đã có 4 job. Khi implement **phải verify gói Vercel còn
  cho thêm cron không**:
  - Nếu còn → thêm `{ "path": "/api/cron/dinh-ky", "schedule": "0 1 1 * *" }` vào `vercel.json`.
  - Nếu hết slot → **gọi `taoPhieuDinhKyChoThang(prisma, {thang hiện tại})` ngay trong
    `cron/thu-thang`** (đã chạy `0 1 1 * *`), không thêm job mới. Hàm chung ở §4.2 cho phép cả 2.

### 4.4 Chỉ số phái sinh — `getChiPhiDuKienThang(prisma)` trong `dashboardQueries.js`
Hàm thuần (không auth), trả:
```
{
  daChiThang,        // chi thực tế tháng hiện tại (ThuChi CHI + laLichSu) — KHỚP getLoiNhuanNam
  conLaiCoDinh,      // Σ phiếu CHO_THANH_TOAN/CHO_HOAN_UNG (laLichSu=false), chưa thành ThuChi,
                     //   có ngày trong tháng hiện tại (COALESCE(ngayCanThanhToan, ngayPhatSinh))
  duKienCaThang,     // = daChiThang + conLaiCoDinh
  conLaiTheoDanhMuc, // [{ danhMucId, tenDanhMuc, soTien }] — phục vụ khối Báo cáo (gộp danh mục)
}
```
- `daChiThang` tính **đúng như `getLoiNhuanNam`** cho tháng hiện tại (ThuChi CHI theo
  `ngayGiaoDich` + DeXuat `laLichSu` theo `COALESCE`), để 2 số không lệch nhau.
- `conLaiCoDinh`: phiếu chưa trả (chưa có `thuChiId`), `laLichSu=false`, ngày rơi trong
  tháng. Phiếu **không có ngày** → vẫn tính vào tháng hiện tại (coi như sắp tới).
- Vì khi phiếu được trả nó chuyển thành `ThuChi` (rời `conLaiCoDinh`, vào `daChiThang`),
  **không bao giờ đếm trùng**; `duKienCaThang` chỉ dịch chuyển nội bộ.

### 4.5 Sửa đếm trùng trong `getDuBao` (BẮT BUỘC)
Khi mẫu định kỳ đã thành **phiếu thật**, `getDuBao` không được vừa cộng `committedDeXuat`
vừa chiếu bóng `phieuDinhKyList` cho cùng một khoản → x2.

**Fix:** với mỗi lần chiếu bóng `PhieuDinhKy` vào ngày `targetDate`, **bỏ qua nếu tháng đó
đã có phiếu định kỳ được tạo** (cùng `danhMucId + noiDung` trong tháng `targetDate`).
- Thực tế: tháng hiện tại đã auto-tạo → dùng phiếu thật (`committedDeXuat`), không chiếu bóng.
- Tháng tương lai (forecast 60/90 ngày) chưa tạo phiếu → vẫn chiếu bóng từ mẫu.
- Cách rẻ: query thêm `DeXuatChiPhi` (laLichSu=false, trạng thái != HUY) trong khoảng
  forecast, gom set `${danhMucId}|${noiDung}|${YYYY-MM}`; khi chiếu bóng mẫu, nếu key có
  trong set thì skip.

### 4.6 Hiển thị — 4 nơi

**a) Dashboard, thẻ "Chi phí tháng này"** (`src/app/page.js`)
Thêm dòng phụ dưới số chính:
`đã chi {daChiThang} · dự kiến thêm ~{conLaiCoDinh} → ước cả tháng ~{duKienCaThang}`.
Chỉ hiện phần "dự kiến thêm" khi `conLaiCoDinh > 0`.

**b) Dashboard, thẻ "Lãi tháng này"**
Thêm dòng phụ: `lãi ước cả tháng ~{doanhThuThang − duKienCaThang}` (đổi màu success/danger
theo dấu). Giải tỏa "lãi ảo cao" giữa tháng. Doanh thu lấy từ dữ liệu dashboard sẵn có.

**c) Báo cáo `/bao-cao`** — khối mới "Chi phí dự kiến sắp tới"
Bảng **gộp theo danh mục** từ `conLaiTheoDanhMuc`: cột Danh mục | Số tiền, dòng tổng =
`conLaiCoDinh`. Kèm câu dẫn: "Các khoản cố định/đang chờ trả còn lại trong tháng — chưa tính
vào 'đã chi'." Ẩn khối khi rỗng. Dùng biến CSS theme (không hardcode màu). Vào `@media print`.

**d) Email "Báo cáo sáng"** (`src/lib/morningBriefing.js` + `src/lib/aiBrief.js`)
- `thuThapDuLieuBaoCao`: gọi thêm `getChiPhiDuKienThang`, thêm vào `hieuSuat`:
  `chiPhiDuKienThang`, `conLaiCoDinh`, `laiDuKienThang (= doanhThuThang − duKienCaThang)`.
- `buildMorningBriefingHTML`: dưới ô "Chi phí tháng" thêm sub `dự kiến cả tháng ~X`; dưới ô
  "Lãi tạm tính" thêm sub `ước cả tháng ~Y`. (Test thuần cập nhật cho field mới.)
- `aiBrief.js`: thêm 3 số mới vào prompt + chỉ thị: AI **không nói "đang lời" dựa trên lãi
  tạm tính** nếu còn `conLaiCoDinh` đáng kể — phải nói theo lãi ước cả tháng và nhắc khoản
  cố định chưa chi. AI vẫn chỉ diễn giải, không bịa số. Thiếu key/timeout → null như cũ.

## 5. Phạm vi & không-đụng

**Đụng:** `src/lib/dinhKy.js` (mới), `src/app/api/dinh-ky/tao-thang-nay/route.js` (đổi ruột),
`src/app/api/cron/dinh-ky/route.js` (mới) **hoặc** `cron/thu-thang` (nếu hết slot),
`vercel.json`, `src/lib/dashboardQueries.js` (`getChiPhiDuKienThang` mới + sửa `getDuBao`),
`src/app/page.js` (2 thẻ KPI), `src/app/bao-cao/page.js` (khối mới),
`src/lib/morningBriefing.js`, `src/lib/aiBrief.js`, test tương ứng.

**KHÔNG đụng:** schema/DB, auth, logic duyệt/sinh `ThuChi`, invariant §4, các API khác.

## 6. Rủi ro

1. **Phiếu auto-tạo chất đống** nếu quên duyệt — nhưng đó chính là checklist "cần trả",
   có chống trùng nên chạy lại an toàn.
2. **Slot cron Vercel** — xử lý theo §4.3.
3. **Lệch số `daChiThang` vs KPI loi-nhuan** — tránh bằng cách tính y hệt `getLoiNhuanNam`.

## 7. Verify
- `npm run build` pass.
- `npm test` pass (cập nhật test `morningBriefing` cho field mới; thêm test
  `getChiPhiDuKienThang` nếu khả thi với mock prisma).
- Test cron `?preview=true` trả danh sách mẫu, không tạo phiếu.

## 8. Cập nhật tài liệu
Sau khi xong: cập nhật `CONTEXT.md` mục 5 (đợt mới), không sửa `CLAUDE.md` §4 (invariant
giữ nguyên — đây là lớp phủ phái sinh).
