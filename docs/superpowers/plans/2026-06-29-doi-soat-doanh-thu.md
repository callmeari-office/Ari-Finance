# PLAN — Đối soát doanh thu (bản tinh gọn) + Bắt buộc lý do điều chỉnh quỹ

> Ngày tạo: 2026-06-29. Tác giả plan: audit ARI-Finance.
> File này chứa **prompt sẵn để dán cho Claude (Sonnet) build code**, chia thành nhiều session độc lập.
> Mỗi session là một phiên Claude MỚI (không nhớ ngữ cảnh cũ) → mỗi prompt đã tự chứa đủ guardrail.

---

## 0. Bối cảnh & mục tiêu (đọc để hiểu, KHÔNG cần build gì ở mục này)

**Vấn đề:** App có hai thế giới tiền tách rời nhau:
- **Doanh thu khai báo** (`DoanhThuHangNgay` → `KeHoachDoanhThu.thucTe`) — số chủ shop gõ tay.
- **Tiền thật vào quỹ** (`ThuChi(THU)` → số dư `Quy`) — phiếu thu tạo riêng.

P&L hiện lấy doanh thu = số khai báo, **không kiểm chứng tiền có thật về không**. Không có cách phát hiện thất thoát/sai sót thu.

**Giải pháp tinh gọn (đã chốt):** KHÔNG đối soát theo "kênh" (quá phức tạp, chủ shop không xác định được tiền về thuộc kênh nào). Thay vào đó:
- **Việc 1 — Đối soát theo THÁNG, mức TỔNG:** so `Doanh thu khai báo (A)` vs `Tiền THU thực nhận (B)`, theo dõi **tỷ lệ B/A qua các tháng** để bắt bất thường (không cần con số tuyệt đối chính xác). Có ô ghi chú thô mỗi tháng ("Shopee chưa về, phí sàn...").
- **Việc 2 — Kiểm quỹ có kỷ luật:** tận dụng tính năng "Điều chỉnh số dư quỹ" đã có sẵn, nhưng **bắt buộc nhập lý do** để biến nó thành dấu vết đối soát thật.

**Giới hạn có chủ ý:** bản này bắt được *xu hướng bất thường + quỹ hao hụt*, CHƯA truy tới từng kênh/phí sàn. Khi shop lớn hơn mới nâng cấp (thêm `ThuChi.kenhBanId`). Đừng build phần kênh trong plan này.

**Điều kiện vận hành tối thiểu:** chủ shop phải bắt đầu ghi nhận "tiền bán hàng đã về" dưới dạng phiếu THU (dù chỉ 1–2 phiếu gộp/tháng, theo QUỸ chứ không theo kênh). App đã hỗ trợ tạo phiếu THU sẵn — không cần build thêm cho việc này.

---

## 1. Nguyên tắc chung cho MỌI session (đã nhúng sẵn trong từng prompt)

- **JavaScript thuần, KHÔNG TypeScript.** Next.js 16 App Router + React 19. Prisma 7 + `@prisma/adapter-pg`.
- **Đọc trước khi code:** `web-app/AGENTS.md`, `web-app/.claude/rules/coding-style.md`, `web-app/.claude/rules/data-sources.md`.
- **Invariant tiền:** "Tiền THU thực nhận" = `ThuChi` loại `THU` với `buTruLichSu = false` (loại phiếu bù trừ lịch sử). Doanh thu khai báo lấy từ `KeHoachDoanhThu.thucTe`.
- **KHÔNG hardcode màu** — dùng CSS vars + semantic tokens (`--success/--danger/--warning/--info` + `-bg`), nền mờ `rgba(var(--brand-brown-rgb), x)`. App chạy 3 theme (light/dark/pink).
- **Mobile-first**, giữ app nhẹ, không thêm thư viện chart nặng.
- **Prisma 7 trên Windows:** `db push` KHÔNG ổn định. Đổi schema bằng file SQL + `npx prisma db execute --file ./prisma/<ten>.sql` (KHÔNG có flag `--schema`). Sau `prisma generate` PHẢI restart dev server.
- **Verify:** `npm test` (logic thuần), `npm run build` (app-level), `npm run db:check` (đụng DB). KHÔNG dùng `npm run lint` (ESLint lỗi môi trường).
- **Phân quyền:** route nghiệp vụ luôn `getSession()` + kiểm role. Đối soát & điều chỉnh quỹ chỉ OWNER/MANAGER (điều chỉnh quỹ: OWNER).
- **Sau khi xong:** cập nhật `CONTEXT.md` (changelog) + `prisma/MIGRATIONS.md` (nếu đụng schema). KHÔNG sửa file `_CORE/`.
- **Không scope-creep:** chỉ làm đúng phần của session, không refactor rộng.

---

## 2. Thứ tự & phụ thuộc các session

```
Session 1 (DB model)  ──►  Session 2 (API)  ──►  Session 3 (UI trang Đối soát)
                                                        │
Session 4 (Bắt buộc lý do điều chỉnh quỹ) ── độc lập, làm song song lúc nào cũng được
                                                        │
                                                        ▼
                                              Session 5 (Kiểm tra cuối + tài liệu)
```

- Session 1 → 2 → 3 phải tuần tự (phụ thuộc nhau).
- Session 4 độc lập hoàn toàn — có thể làm trước/sau/song song.
- Session 5 làm cuối cùng.

---

## SESSION 1 — Tạo bảng ghi chú đối soát `DoiSoatThang`

**Mục tiêu:** thêm 1 bảng nhỏ lưu ghi chú đối soát mỗi tháng. Không có FK, rất nhẹ.

**File đụng tới:** `prisma/schema.prisma`, `prisma/add-doi-soat-thang.sql` (mới), `prisma/MIGRATIONS.md`.

**Prompt dán cho Claude:**

```
Bạn là kỹ sư cẩn thận làm việc trên app ARI-Finance (web-app/). Đọc trước: web-app/AGENTS.md, web-app/.claude/rules/coding-style.md, đặc biệt mục "Database Rules" về Prisma 7 trên Windows.

NHIỆM VỤ: Thêm một bảng mới `DoiSoatThang` để lưu ghi chú đối soát doanh thu theo tháng. Đây là bảng độc lập, KHÔNG khóa ngoại.

Cấu trúc bảng:
- id: String @id @default(uuid())
- nam: Int
- thang: Int (1-12)
- ghiChu: String?  (lý do chênh lệch, tối đa 500 ký tự — validate ở API, không ở DB)
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- @@unique([nam, thang])

CÁC BƯỚC:
1. Thêm model `DoiSoatThang` vào prisma/schema.prisma (đặt gần các model nghiệp vụ khác, kèm comment tiếng Việt 1 dòng giải thích mục đích).
2. Tạo file prisma/add-doi-soat-thang.sql theo đúng phong cách các file add-*.sql hiện có (CREATE TABLE IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS). Tham khảo prisma/add-login-attempt.sql và prisma/add-butru-lichsu.sql để bám phong cách.
3. Áp dụng migration: npx prisma db execute --file ./prisma/add-doi-soat-thang.sql  (KHÔNG dùng flag --schema — Prisma 7 đọc từ prisma.config.ts).
4. npx prisma generate.
5. Cập nhật prisma/MIGRATIONS.md: thêm mục ghi lại migration này (ngày, tên file, mục đích).

QUY TẮC: JavaScript/Prisma thuần, không TypeScript. KHÔNG dùng prisma db push (không ổn định trên Windows).

ACCEPTANCE:
- Bảng DoiSoatThang tồn tại trong DB (db execute chạy thành công).
- npm run db:check pass (không drift).
- npx prisma generate thành công, model DoiSoatThang xuất hiện trong client.

Khi xong: tóm tắt file đã đổi + lệnh đã chạy + kết quả.
```

**Verify thủ công sau session:** `npm run db:check` pass; `prisma/add-doi-soat-thang.sql` tồn tại; MIGRATIONS.md có mục mới.

---

## SESSION 2 — API `/api/doi-soat` (GET dữ liệu + POST ghi chú) + helper thuần có test

**Mục tiêu:** API trả số liệu đối soát 12 tháng của 1 năm + lưu ghi chú. Tách phần tính tỷ lệ/phát hiện bất thường thành **hàm thuần có unit test**.

**Phụ thuộc:** Session 1 xong.

**File đụng tới:** `src/app/api/doi-soat/route.js` (mới), `src/lib/doiSoat.js` (mới, hàm thuần), `src/lib/doiSoat.test.js` (mới).

**Prompt dán cho Claude:**

```
Bạn là kỹ sư cẩn thận làm việc trên app ARI-Finance (web-app/). Đọc trước: web-app/AGENTS.md, web-app/.claude/rules/data-sources.md (rất quan trọng — invariant nguồn tiền), và xem mẫu route src/app/api/loi-nhuan/route.js + helper src/lib/dashboardQueries.js (hàm getLoiNhuanNam) để bám phong cách query.

BỐI CẢNH: Đang xây tính năng "Đối soát doanh thu" mức tổng theo tháng. Mục tiêu: so doanh thu khai báo (A) với tiền THU thực nhận (B), theo dõi tỷ lệ B/A để bắt bất thường. KHÔNG làm theo kênh.

NHIỆM VỤ 1 — Hàm thuần src/lib/doiSoat.js (test được, KHÔNG đụng DB):
- export function tinhDoiSoat(months): nhận mảng 12 phần tử { thang, doanhThuKhaiBao, tienThucNhan, ghiChu } → trả về mảng có thêm:
    - chenhLech = doanhThuKhaiBao - tienThucNhan
    - tyLe = phần trăm tienThucNhan/doanhThuKhaiBao, làm tròn số nguyên; nếu doanhThuKhaiBao <= 0 thì tyLe = null (không tính).
- export function phatHienBatThuong(rows, { nguong = 15 } = {}): dựa trên các tháng CÓ tyLe (khác null và doanhThuKhaiBao > 0), tính TRUNG VỊ (median) của tyLe; đánh dấu batThuong = true cho tháng nào có tyLe < (median - nguong). Trả lại rows kèm cờ batThuong + trường trungViTyLe. Nếu có < 3 tháng đủ dữ liệu thì KHÔNG đánh bất thường (không đủ cơ sở), batThuong = false hết.
- Dùng cách làm tròn an toàn giống src/lib/finance.js (tham khảo phanTramDat). Không trả NaN/Infinity.

NHIỆM VỤ 2 — src/lib/doiSoat.test.js (vitest): test tinhDoiSoat (chia 0 → null, làm tròn) và phatHienBatThuong (median, ngưỡng, <3 tháng không flag, tháng tụt sâu bị flag).

NHIỆM VỤ 3 — API src/app/api/doi-soat/route.js:
- GET ?nam=YYYY (mặc định năm hiện tại). Quyền: chỉ OWNER + MANAGER (giống /api/loi-nhuan). Trả về { nam, months: [...12 tháng đã qua tinhDoiSoat + phatHienBatThuong], tong: { doanhThuKhaiBao, tienThucNhan, chenhLech, tyLe } }.
    - doanhThuKhaiBao theo tháng: groupBy KeHoachDoanhThu theo thang, _sum.thucTe, where nam.
    - tienThucNhan theo tháng: tổng ThuChi loại THU theo tháng (EXTRACT MONTH FROM ngayGiaoDich), BẮT BUỘC điều kiện buTruLichSu = false (raw SQL giống getLoiNhuanNam). KHÔNG được tính phiếu bù trừ.
    - ghiChu theo tháng: lấy từ bảng DoiSoatThang (nam, thang).
- POST: upsert ghi chú. Quyền OWNER + MANAGER. Body { nam, thang, ghiChu }. Validate nam hợp lệ, thang 1-12, ghiChu là string <= 500 ký tự (cho phép rỗng/null để xóa ghi chú). Upsert theo unique (nam, thang). Ghi nhật ký bằng ghiNhatKy (hanhDong 'SUA', doiTuong 'DOI_SOAT', moTa ngắn gọn) — xem src/lib/audit.js cách dùng.
- Bắt lỗi trả JSON { error } + status chuẩn (401/403/400/500), dùng logger.

QUY TẮC: JavaScript thuần. Chuỗi tiếng Việt phải gõ UTF-8 ĐÚNG (không để mojibake). Số tiền không cần làm tròn lại (đã tròn khi ghi), nhưng ép Number an toàn khi đọc từ raw SQL (Number(x || 0)).

ACCEPTANCE:
- npm test pass (test mới của doiSoat).
- npm run build pass.
- GET /api/doi-soat?nam=2026 trả đúng cấu trúc; tổng B chỉ gồm THU buTruLichSu=false.

Khi xong: tóm tắt file đã tạo + xác nhận đã chạy npm test và npm run build kèm kết quả.
```

**Verify thủ công sau session:** `npm test` pass; `npm run build` pass; mở thử `GET /api/doi-soat?nam=2026` khi dev server chạy.

---

## SESSION 3 — Trang `/doi-soat` + menu Sidebar + permission key

**Mục tiêu:** màn hình đối soát mobile-first: bảng 12 tháng (A / B / chênh lệch / tỷ lệ), tô đỏ tháng bất thường, ô ghi chú lưu được, dòng tổng. Thêm menu + phân quyền.

**Phụ thuộc:** Session 2 xong.

**File đụng tới:** `src/app/doi-soat/page.js` (mới) + CSS module, `src/lib/roles.js` (thêm key `doiSoat`), `src/components/Sidebar.js`, trang `/quyen` tự nhận key mới nếu nó duyệt theo DEFAULT_MENU_ROLES.

**Prompt dán cho Claude:**

```
Bạn là kỹ sư frontend cẩn thận trên app ARI-Finance (web-app/). Đọc trước: web-app/.claude/rules/coding-style.md (mục Theme & Color Rules — TUYỆT ĐỐI không hardcode màu), và xem trang src/app/loi-nhuan/page.js làm mẫu bố cục (KPI + bảng theo tháng, mobile-first, dùng glass-card/custom-table, AnimatedNumber nếu phù hợp).

BỐI CẢNH: API GET/POST /api/doi-soat đã có (Session 2). Trả { nam, months: [{ thang, doanhThuKhaiBao, tienThucNhan, chenhLech, tyLe, ghiChu, batThuong }], tong, ... }. Giờ build UI.

NHIỆM VỤ 1 — Trang src/app/doi-soat/page.js (client component):
- Chọn năm (giống các trang khác). Gọi GET /api/doi-soat?nam=...
- Thẻ tổng (KPI) trên cùng: Tổng doanh thu khai báo, Tổng tiền thực nhận, Tỷ lệ chung, Chênh lệch. Dùng semantic color tokens.
- Bảng/danh sách 12 tháng, mỗi dòng: Tháng | Doanh thu khai báo (A) | Tiền thực nhận (B) | Chênh lệch | Tỷ lệ B/A.
    - Tỷ lệ = null (A=0) → hiển thị "—".
    - Tháng batThuong = true → tô nền cảnh báo (var(--warning-bg)/var(--danger-bg)) + icon cảnh báo, kèm tooltip/chú thích "Tỷ lệ tiền về thấp bất thường so với trung vị — nên kiểm tra".
    - Ô ghi chú mỗi tháng (textarea/input ngắn) — sửa xong bấm lưu → POST /api/doi-soat { nam, thang, ghiChu } → toast thành công.
- Mobile-first: trên màn nhỏ chuyển bảng thành card xếp dọc (xem cách các trang khác xử lý responsive). tabular-nums đã bật toàn app.
- Có chú thích ngắn ở đầu trang giải thích: "Chênh lệch gồm tiền đang về (sàn TMĐT trễ) + phí + sai lệch. Theo dõi TỶ LỆ qua các tháng để phát hiện bất thường."
- Tạo CSS module riêng (doi-soat.module.css) nếu cần; KHÔNG hardcode màu.

NHIỆM VỤ 2 — Phân quyền + menu:
- src/lib/roles.js: thêm key `doiSoat: ['OWNER', 'MANAGER']` vào DEFAULT_MENU_ROLES (đặt cạnh loiNhuan/baoCao cho hợp nhóm).
- src/components/Sidebar.js: thêm mục menu "Đối soát doanh thu" trỏ /doi-soat, hiển thị theo canViewMenu(user, 'doiSoat'), icon lucide phù hợp (vd Scale hoặc GitCompare). Đặt gần mục Doanh thu/Lợi nhuận.
- Trang /quyen: nếu nó tự liệt kê key từ DEFAULT_MENU_ROLES thì không cần sửa; nếu hard-code danh sách key thì thêm 'doiSoat' với nhãn "Đối soát doanh thu". Kiểm tra src/app/quyen/page.js và xử lý cho đúng.
- Page guard: trong doi-soat/page.js, nếu user không có quyền (canViewMenu false) thì điều hướng/hiện thông báo như các trang OWNER/MANAGER khác.

QUY TẮC: JavaScript thuần, không TypeScript. Chuỗi tiếng Việt UTF-8 đúng. Không thêm thư viện chart nặng — nếu muốn minh hoạ xu hướng tỷ lệ thì dùng thanh ngang CSS đơn giản, không kéo lib.

ACCEPTANCE:
- npm run build pass (số trang tăng đúng 1, không lỗi).
- Đăng nhập owner/Ari@123456789 vào /doi-soat thấy bảng; STAFF không thấy menu.
- Sửa + lưu ghi chú một tháng → reload vẫn còn.

Khi xong: tóm tắt file đã đổi + xác nhận npm run build pass.
```

**Verify thủ công sau session:** đăng nhập owner xem `/doi-soat`; đăng nhập `test_staff` xác nhận không thấy menu; lưu ghi chú thử.

---

## SESSION 4 — Bắt buộc lý do khi điều chỉnh số dư quỹ (Việc 2) — ĐỘC LẬP

**Mục tiêu:** biến "Điều chỉnh số dư quỹ" thành dấu vết đối soát thật — bắt buộc nhập lý do (cả API lẫn UI).

**Phụ thuộc:** không (làm lúc nào cũng được).

**File đụng tới:** `src/app/api/quy/[id]/dieu-chinh/route.js`, `src/app/quy/page.js` (modal điều chỉnh).

**Prompt dán cho Claude:**

```
Bạn là kỹ sư cẩn thận trên app ARI-Finance (web-app/). Đọc trước: web-app/AGENTS.md.

BỐI CẢNH: API POST /api/quy/[id]/dieu-chinh hiện cho OWNER cân bằng số dư quỹ, có tham số lyDo NHƯNG đang là TÙY CHỌN. Việc điều chỉnh quỹ là thao tác tài chính nhạy cảm — cần bắt buộc ghi lý do để phục vụ đối soát/audit.

NHIỆM VỤ 1 — Backend src/app/api/quy/[id]/dieu-chinh/route.js:
- Bắt buộc lyDo: nếu lyDo trống/chỉ khoảng trắng → trả 400 { error: "Vui lòng nhập lý do điều chỉnh số dư." }. Đặt check này trước khi cập nhật.
- Giới hạn độ dài lyDo hợp lý (vd <= 300 ký tự, cắt như hiện tại).
- Giữ nguyên phần còn lại (tính soDuDieuChinh, ghiNhatKy). Đảm bảo nhật ký vẫn ghi rõ lý do (đã có).

NHIỆM VỤ 2 — Frontend modal điều chỉnh quỹ trong src/app/quy/page.js:
- Tìm modal/form "Điều chỉnh số dư". Làm ô "Lý do" thành BẮT BUỘC: thêm dấu *, nút Xác nhận disable khi lý do trống, hiển thị lỗi inline nếu để trống.
- Thông báo lỗi từ API (nếu có) hiển thị cho người dùng.

QUY TẮC: JavaScript thuần. Chuỗi tiếng Việt UTF-8 đúng, không hardcode màu (dùng token).

ACCEPTANCE:
- npm run build pass.
- Gọi API điều chỉnh không kèm lyDo → trả 400, không thay đổi số dư.
- Trên UI, không nhập lý do thì không bấm xác nhận được.

Khi xong: tóm tắt file đã đổi + xác nhận npm run build pass.
```

**Verify thủ công sau session:** thử điều chỉnh 1 quỹ không nhập lý do → bị chặn.

---

## SESSION 5 — Kiểm tra cuối, dữ liệu mẫu & cập nhật tài liệu

**Mục tiêu:** chạy toàn bộ verify, kiểm tra end-to-end nhẹ, cập nhật CONTEXT.md.

**Phụ thuộc:** Session 1–4 xong.

**Prompt dán cho Claude:**

```
Bạn là kỹ sư QA/maintainer trên app ARI-Finance (web-app/). Tính năng "Đối soát doanh thu" (trang /doi-soat + API /api/doi-soat + bảng DoiSoatThang) và "Bắt buộc lý do điều chỉnh quỹ" vừa được build qua các session trước.

NHIỆM VỤ:
1. Chạy đầy đủ verify và báo cáo kết quả thật:
   - npm test
   - npm run build
   - npm run db:check
   Nếu có lỗi → sửa tối thiểu cho pass, mô tả đã sửa gì. KHÔNG refactor rộng.
2. Rà soát nhanh tính nhất quán số liệu: xác nhận "Tiền THU thực nhận" trong /api/doi-soat loại buTruLichSu=false, và doanh thu khai báo khớp nguồn KeHoachDoanhThu.thucTe (cùng nguồn với Dashboard/Lợi nhuận). Nêu rõ nếu phát hiện lệch.
3. Rà soát toàn bộ chuỗi tiếng Việt trong các file mới tạo (api/doi-soat, lib/doiSoat, app/doi-soat) — KHÔNG được có ký tự mojibake (Ã, Â, », Ä‘...). Sửa nếu có.
4. Cập nhật CONTEXT.md: thêm một mục changelog (ngày 2026, "Đợt mới: Đối soát doanh thu tinh gọn + bắt buộc lý do điều chỉnh quỹ") mô tả ngắn gọn: bảng DoiSoatThang, API /api/doi-soat (GET/POST), trang /doi-soat, key quyền doiSoat, thay đổi bắt buộc lyDo. Ghi rõ lệnh verify đã chạy + kết quả.
5. (Tùy chọn) Nếu thuận tiện, thêm vài dòng dữ liệu THU mẫu qua giao diện để màn /doi-soat có số minh hoạ — nhưng KHÔNG bịa số vào DB production; chỉ hướng dẫn cách tạo nếu cần.

ACCEPTANCE: cả 3 lệnh verify pass; CONTEXT.md đã cập nhật; không còn mojibake trong file mới.

Khi xong: liệt kê kết quả từng lệnh verify + tóm tắt thay đổi tài liệu.
```

---

## 3. Checklist tổng (đánh dấu khi hoàn thành)

- [ ] **S1** — Bảng `DoiSoatThang` + SQL migration + MIGRATIONS.md + db:check pass
- [ ] **S2** — `lib/doiSoat.js` + test pass + API `/api/doi-soat` (GET/POST) + build pass
- [ ] **S3** — Trang `/doi-soat` + menu Sidebar + key `doiSoat` + build pass
- [ ] **S4** — Bắt buộc lý do điều chỉnh quỹ (API + UI) + build pass
- [ ] **S5** — Verify toàn bộ (test/build/db:check) + không mojibake + CONTEXT.md cập nhật

## 4. Gợi ý vận hành sau khi build xong (cho chủ shop)

1. Hằng tháng: tạo 1–2 phiếu **THU** ghi "tiền bán hàng đã về" theo từng QUỸ (tiền mặt / ngân hàng) — không cần theo kênh.
2. Mở **/doi-soat** xem cột Tỷ lệ. Tháng nào tỷ lệ tụt sâu so với các tháng khác (được tô cảnh báo) → kiểm tra: gõ nhầm doanh thu? đơn hủy chưa trừ? thu thiếu?
3. Cuối tháng: **kiểm quỹ thực tế**, nếu lệch dùng "Điều chỉnh số dư" và BẮT BUỘC ghi lý do. Lệch giảm lặp lại nhiều tháng → dấu hiệu rò rỉ.

## 5. KHÔNG làm trong plan này (để sau, tránh phình)

- Đối soát theo kênh (`ThuChi.kenhBanId`, `KenhBan.quyMacDinh`, bảng settlement).
- Tách phí sàn TMĐT theo kênh.
- Tự động hóa nhập tiền-về từ sàn.
→ Chỉ cân nhắc khi tỉ trọng TMĐT lớn và bản tinh gọn này đã chứng minh nhu cầu.
