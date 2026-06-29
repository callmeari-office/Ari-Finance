# Spec — Tách "sắp tới hạn N ngày" khỏi "dự kiến cả tháng" (chi phí định kỳ)

> Ngày: 2026-06-29. Trạng thái: **chờ user review** → plan → implement.
> Bối cảnh: nối tiếp `2026-06-16-chi-phi-du-kien-dinh-ky-design.md`. Invariant nguồn chi: `CLAUDE.md` §4 (KHÔNG đụng).

## 1. Vấn đề

Cron ngày 1 tự tạo **cả loạt** phiếu định kỳ của tháng (`DeXuatChiPhi`, `CHO_THANH_TOAN`)
từ mẫu `PhieuDinhKy`. Lớp phái sinh `getChiPhiDuKienThang` gộp **toàn bộ khoản cố định còn
lại trong tháng** thành một cục `conLaiCoDinh`. Hệ quả: ngay đầu tháng, khoản tận ngày 22
(lãi vay…) đã nằm chung với khoản ngày 2 trong "dự kiến chi" → báo cáo/kế hoạch nhìn **nặng
hơn thực tế** ở thời điểm hiện tại. Người dùng thấy "chi phí cố định xa quá".

Điểm đau (đã chốt qua brainstorm): **B — con số "dự kiến/còn lại" bị thổi sớm.** Không phải
A (rác queue duyệt — để sau).

## 2. Nguyên tắc & hướng

- **Hướng 1 (đã chốt): lớp tính toán phái sinh.** GIỮ NGUYÊN cron tạo phiếu ngày 1, GIỮ
  NGUYÊN DB phiếu. Chỉ thêm **một lát cắt theo ngày tới hạn** để tách "sắp tới hạn ≤N ngày"
  khỏi "cả tháng". Không đụng cron, không đụng invariant §4. Backward-compatible: chỉ THÊM
  field vào return của `getChiPhiDuKienThang`, consumer cũ (email, dashboard) không vỡ.
- **Mục tiêu UX:** luôn cho 2 con số **tách bạch**, không gộp:
  - *Dự kiến cả tháng* (đường dài, đã có) = đã chi + tất cả khoản cố định còn lại trong tháng.
  - *Sắp tới hạn N ngày* (tiền mặt cần ngay) = khoản còn lại có ngày tới hạn ≤ hôm nay + N.

## 3. Quyết định đã chốt (qua brainstorm)

| Vấn đề | Quyết định |
|---|---|
| Cách tiếp cận | Lớp phái sinh, không đụng cron/DB phiếu |
| "Sắp tới hạn" trả lời gì | Cả hai, **tách bạch**: tổng cả tháng + sắp tới hạn trong N ngày |
| Cửa sổ N | **Cấu hình được**, mặc định **7** ngày |
| Khoản quá hạn chưa trả | **Gộp vào `sapToiHan`** (gấp hơn cả sắp tới) |
| Nơi hiển thị | **Dashboard** + **Kế hoạch (DB Tháng)**. KHÔNG đụng Báo cáo/Email |
| Ràng buộc giao diện | Tối ưu **cả web + mobile** (flex-wrap, chữ phụ nhỏ) |

## 4. Thiết kế chi tiết

### 4.1 Tham số N — bảng cấu hình key–value mới
App chưa có chỗ lưu tham số. Thêm bảng nhỏ qua `db execute` SQL (đúng quy ước Prisma 7 trên
Windows — `.claude/rules/coding-style.md`):

```
model CauHinh {
  khoa     String  @id      // ví dụ "soNgaySapToiHan"
  giaTri   String           // lưu chuỗi, parse khi đọc
  capNhat  DateTime @updatedAt
}
```
- Seed mặc định: `soNgaySapToiHan = "7"` (thêm vào `prisma/seed.js` + chạy 1 lần trên prod
  qua SQL insert idempotent `ON CONFLICT DO NOTHING`).
- Helper `src/lib/cauHinh.js`: `getSoNgaySapToiHan(prisma)` → đọc khóa, parse int, fallback 7
  nếu thiếu/lỗi. Clamp [1, 28].
- API `GET/PUT /api/cau-hinh/tham-so` (OWNER/MANAGER): đọc/ghi khóa `soNgaySapToiHan`.
- UI: thêm 1 ô nhập nhỏ "Cửa sổ cảnh báo sắp tới hạn (ngày)" trong trang `/cau-hinh`
  (section mới "Tham số hệ thống"), input number, lưu qua API trên. Theme-token, mobile-ok.

### 4.2 Mở rộng `getChiPhiDuKienThang(prisma)` — `src/lib/dashboardQueries.js`
Đổi query `conLaiRows` để **trả thêm ngày tới hạn** mỗi dòng (bỏ GROUP BY trong SQL, group ở
JS) hoặc thêm cột `ngay = COALESCE(ngayCanThanhToan, ngayPhatSinh)` và `danhMucId/tenDanhMuc/soTien`.

Đọc N qua `getSoNgaySapToiHan(prisma)`. Tính ngưỡng `nguong = cuối ngày (hôm nay + N)`.

Hàm pure mới (testable, cạnh `gomConLaiTheoDanhMuc`):
`splitSapToiHan(rows, nguong)` → chia rows thành 2 nhóm theo `ngay <= nguong` (đã bao gồm
quá hạn vì `ngay < hôm nay <= nguong`), trả `{ sapToiHanRows, conLaiXaRows }`.

Return mở rộng (giữ field cũ, THÊM field mới):
```
{
  daChiThang,              // (cũ) đã chi thực tế — KHỚP getLoiNhuanNam
  conLaiCoDinh,            // (cũ) Σ tất cả khoản cố định còn lại trong tháng
  duKienCaThang,           // (cũ) = daChiThang + conLaiCoDinh
  conLaiTheoDanhMuc,       // (cũ) gộp theo danh mục — toàn bộ còn lại
  // --- mới ---
  soNgay,                  // = N (để hiển thị "sắp tới hạn 7 ngày")
  sapToiHan,               // Σ khoản còn lại có ngày tới hạn <= hôm nay + N (gồm quá hạn)
  sapToiHanTheoDanhMuc,    // gộp theo danh mục của subset sắp tới hạn
  conLaiXa,                // = conLaiCoDinh - sapToiHan (phần xa, ngoài cửa sổ N)
}
```
Backward-compatible: chỉ thêm key. `Math.round` mọi số tiền như cũ.

### 4.3 Dashboard — `src/app/page.js`, thẻ "Chi phí tháng này"
Thay subline đang gộp xa-gần:
```
CŨ:  đã chi {chiPhiThang} · dự kiến thêm ~{conLaiCoDinh} → ước cả tháng ~{duKienCaThang}
```
thành 2 dòng phụ, **dẫn bằng số gần**:
```
🟠 sắp tới hạn {soNgay} ngày  ~{sapToiHan}      ← màu var(--warning), chỉ hiện khi sapToiHan>0
   cả tháng ~{duKienCaThang}                    ← màu var(--text-muted), nhỏ, hiện khi conLaiCoDinh>0
```
- Thẻ "Lãi tháng này": **giữ nguyên** dòng "ước lãi cả tháng" (đây là góc nhìn đường dài đúng).
- Mobile: 2 dòng phụ stack tự nhiên, không thêm chiều ngang.

### 4.4 Kế hoạch — `src/app/ke-hoach/page.js`, view "DB Tháng", CHỈ tháng hiện tại
Page fetch thêm `/api/chi-phi-du-kien` (route đã có — cập nhật để trả field mới ở 4.2).
Chỉ render khi `isCurrentMonth` và có dữ liệu (`conLaiCoDinh > 0`).

**3a — Banner gọn** (dưới khu KPI, trên charts):
```
📌 Cố định chưa chi tháng này: ~{conLaiCoDinh}  ·  🟠 sắp tới hạn {soNgay} ngày: ~{sapToiHan}
```
- Container `display:flex; flex-wrap:wrap; gap` → mobile tự xuống 2 dòng. Theme-token, không
  hardcode màu (phần "sắp tới hạn" dùng `var(--warning)`).

**3b — Sửa nghĩa "Còn được chi"** ở thẻ "Thực chi T{thang}":
Khi `conLaiCoDinh > 0`, thêm chú thích mờ dưới dòng "Còn được chi {conLai}":
```
Còn được chi {conLai}
(đã cam kết ~{conLaiCoDinh} sắp chi)        ← font nhỏ, var(--text-muted)
```
→ Không bị tưởng là dư ngân sách. Ẩn khi không có khoản cam kết.

KHÔNG đụng: thẻ "Dự đoán cuối tháng" (run-rate), view DB Năm, view lập Kế hoạch.

## 5. Phạm vi & không-đụng

**Đụng:**
- `prisma/schema.prisma` (+ model `CauHinh`), migration SQL `prisma/*.sql`, `prisma/seed.js`.
- `src/lib/cauHinh.js` (mới), `src/app/api/cau-hinh/tham-so/route.js` (mới).
- `src/lib/dashboardQueries.js` (`getChiPhiDuKienThang` mở rộng + `splitSapToiHan` mới).
- `src/app/api/chi-phi-du-kien/route.js` (trả field mới — tự động nếu chỉ pass-through).
- `src/app/page.js` (subline thẻ Chi phí).
- `src/app/ke-hoach/page.js` (banner 3a + subline 3b) + CSS module nếu cần.
- `src/app/cau-hinh/page.js` (ô nhập N) + CSS.
- Test: `src/lib/chiPhiDuKien.test.js` (thêm test `splitSapToiHan`).

**KHÔNG đụng:** cron `dinh-ky`/`thu-thang`, `src/lib/dinhKy.js`, luồng duyệt → sinh `ThuChi`,
invariant §4, email Báo cáo sáng (`morningBriefing`/`aiBrief`), Báo cáo `/bao-cao`, getDuBao.

## 6. Rủi ro & lưu ý

1. **Migration trên prod (Supabase):** thêm bảng `CauHinh` qua `db execute` SQL; sau đó
   `prisma generate` + **restart dev server** (Turbopack cache client cũ — coding-style).
2. **Backward-compat return:** chỉ thêm key vào `getChiPhiDuKienThang` → email/dashboard cũ
   vẫn chạy. Phải kiểm tra không có chỗ nào destructure kiểu strict gây lỗi.
3. **Quá hạn gộp vào `sapToiHan`:** đúng chủ đích — nếu tháng có nhiều khoản quá hạn chưa trả,
   `sapToiHan` có thể ≈ `conLaiCoDinh`. Chấp nhận (đó là tiền thật cần lo).
4. **Mobile:** banner 3a phải flex-wrap; subline 3b font nhỏ, không đẩy vỡ thẻ KPI.

## 7. Verify

- `npm run build` pass (KHÔNG dùng `npm run lint` — ESLint 10 lỗi môi trường).
- `npm test` pass; thêm test `splitSapToiHan` (gồm case quá hạn, case rỗng, biên `ngay == nguong`).
- Thủ công: đổi N trong Cấu hình → Dashboard + Kế hoạch đổi nhãn "sắp tới hạn X ngày" theo.
- Thủ công mobile (DevTools ~380px): banner 3a wrap đẹp, thẻ Chi phí không vỡ.

## 8. Cập nhật tài liệu
Sau khi xong: cập nhật `CONTEXT.md` mục 5 (đợt mới). KHÔNG sửa `CLAUDE.md` §4 (invariant giữ
nguyên — đây là lớp phủ phái sinh).
