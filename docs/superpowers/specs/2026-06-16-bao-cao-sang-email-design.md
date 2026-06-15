# Spec: Email "Báo cáo sáng" (Daily Morning Briefing)

Ngày: 2026-06-16 · Trạng thái: Đã duyệt thiết kế, sẵn sàng triển khai.

## 1. Mục tiêu
Mỗi 8:00 sáng, gửi email tóm tắt hiện trạng tài chính shop cho **Owner + Manager**, bằng ngôn ngữ dễ hiểu, để chỉ cần liếc email là nắm tình hình. Gồm: tiền & hiệu suất, việc cần xử lý, cảnh báo rủi ro, và **nhận định + đề xuất do AI viết**.

## 2. Quyết định đã chốt
- Mục đích: cân bằng cả ba (rủi ro + việc cần làm + hiệu suất).
- Đúc kết: **Hybrid** — số liệu từ mẫu cố định (chính xác), AI chỉ viết phần *nhận định* + *đề xuất* (diễn giải, không bịa số).
- Người nhận: Owner + Manager (`getManagerRecipients()` đã có sẵn, trả đúng nhóm này).
- Nhịp: gửi **mỗi sáng** kể cả ngày yên ả (bản ngắn "mọi thứ ổn").
- Số tiền: rút gọn dạng "124tr"; riêng **Tiền đang có** hiển thị đầy đủ "48.250.000đ".
- Bật/tắt: bằng **biến môi trường** `EMAIL_BAO_CAO_SANG=on` (đồng nhất với `EMAIL_CHO_THANH_TOAN` hiện có — app KHÔNG có bảng settings, KHÔNG đổi schema, KHÔNG làm UI toggle).

## 3. Kiến trúc & file
Tái dùng tối đa hạ tầng sẵn có (cron + nodemailer + dashboardQueries). Không đụng auth/DB schema.

| File | Vai trò |
|---|---|
| `src/lib/morningBriefing.js` (mới) | `thuThapDuLieuBaoCao(prisma)` → gom số liệu (thuần data). `buildMorningBriefingHTML(data, ai)` → dựng HTML email-safe (THUẦN, test được). + helper `formatTrieu`. |
| `src/lib/aiBrief.js` (mới) | `taoNhanDinhAI(data)` → gọi Claude Haiku 4.5, trả `{ nhanDinh, deXuat[] }` hoặc `null` nếu lỗi. |
| `src/lib/email.js` (sửa) | Thêm `sendMorningBriefing({ data, ai, preview, previewEmail })` — chọn người nhận, gọi `buildMorningBriefingHTML`, gửi qua transporter sẵn có. |
| `src/app/api/cron/bao-cao-sang/route.js` (mới) | Cron: check `CRON_SECRET` + env bật/tắt → gather → AI → send. Pattern try/catch từng phần như `cron/thong-bao`. Hỗ trợ `?preview=<email>` để gửi thử. |
| `vercel.json` (sửa) | Thêm cron `{ "path": "/api/cron/bao-cao-sang", "schedule": "0 1 * * *" }` (8:00 ICT). |
| `.env.example` (sửa) | Thêm `ANTHROPIC_API_KEY`, `EMAIL_BAO_CAO_SANG`. |
| `package.json` | Thêm dep `@anthropic-ai/sdk`. |
| Tests | `morningBriefing.test.js` cho `buildMorningBriefingHTML` + `formatTrieu` (pure). |

## 4. Hợp đồng dữ liệu — `thuThapDuLieuBaoCao(prisma)`
Dùng đúng nguồn dữ liệu chuẩn (§4 CLAUDE.md). Trả object:
```
{
  ngay: Date,
  tien: { tongTien, quyList: [{tenQuy, soDuHienTai}], soNgayConTru, canhBaoAm, ngayCoTheAm },
  hieuSuat: { doanhThuThang, mucTieuThang, pctDat, chiPhiThang, laiThang, doanhThuHomQua },
  canXuLy: { choThanhToan:{count,tong}, choHoanUng:{count,tong}, quaHan:{count,tong}, chuaNhapDoanhThu:{soKenh} },
  canhBao: { nhacHan:[], vuotHanMuc:[], vuotKeHoach:[], tongSo },
}
```
Nguồn:
- `tien`: `getFunds(prisma)` → `tongTien = Σ soDuHienTai`, `quyList`. `getDuBao(prisma,'thang')` → `soNgayConTru = round(tongTien / giaDinh.avgChiNgay)` (guard chia 0 → null), `canhBaoAm`, `ngayCoTheAm`.
- `hieuSuat`: `getLoiNhuanNam(prisma, nam).months[thangHienTai-1]` → `doanhThuThang=doanhThuThucTe`, `mucTieuThang=doanhThuChiTieu`, `chiPhiThang=chiPhiThucTe`, `laiThang=loiNhuanThucTe`; `pctDat = phanTramDat(doanhThuThang, mucTieuThang)`. `doanhThuHomQua`: `DoanhThuHangNgay` sum ngày hôm qua.
- `canXuLy`: count + sum `deXuatChiPhi` theo trạng thái (giống `/api/dashboard`): CHO_THANH_TOAN, CHO_HOAN_UNG, quá hạn (`ngayCanThanhToan < hômnay` & trạng thái chờ). `chuaNhapDoanhThu`: số kênh ACTIVE chưa có `DoanhThuHangNgay` hôm qua.
- `canhBao`: `getCanhBao(prisma, 3)` → `nhacHan, vuotHanMuc, vuotKeHoach, tongSo`.

Số tiền hiển thị chuẩn hóa qua `lamTronTien`/`formatTrieu` đã có.

## 5. AI — `taoNhanDinhAI(data)`
- Model: `claude-haiku-4-5-20251001` qua `@anthropic-ai/sdk`. `max_tokens` ~600.
- Không có `ANTHROPIC_API_KEY` → trả `null` ngay (không gọi API).
- System prompt (tiếng Việt): persona trợ lý của Call Me Ari; văn phong ấm, **đơn giản, dễ hiểu** cho chủ shop không rành tài chính; **CHỈ diễn giải các con số được cung cấp, TUYỆT ĐỐI không bịa số mới**; trả về **JSON** `{ "nhanDinh": "...", "deXuat": ["...","...","..."] }`; `nhanDinh` 3–5 câu; `deXuat` 2–3 gợi ý hành động cụ thể.
- Input: JSON gọn của `data` (đã có sẵn mọi số) trong user message.
- Parse JSON an toàn; lỗi/parse fail/timeout → trả `null`. Bọc try/catch, log qua `logger`.

## 6. Email — `buildMorningBriefingHTML(data, ai)` + `sendMorningBriefing(...)`
- HTML **email-safe**: dùng `<table>` + inline style (Gmail/Outlook), tông nâu–kem–hồng phấn theo mockup v2 đã duyệt.
- Header: ảnh cameo `${APP_URL}/ari-cameo.png` (URL tuyệt đối) + "Call Me Ari · Báo cáo sáng" + ngày.
- 6 khối: ① Nhận định AI · ② Tiền & Hiệu suất (Tiền đang có đầy đủ + thẻ doanh thu/chi phí/lãi/hôm qua rút gọn) · ③ Cần xử lý · ④ Cảnh báo rủi ro (chỉ hiện khi có) · ⑤ Đề xuất từ Ari (AI) · ⑥ CTA "Mở app" (`APP_URL`).
- **Nếu `ai === null`**: bỏ khối ① và ⑤, vẫn gửi đầy đủ số liệu (email không bao giờ kẹt).
- **Ngày yên ả** (không cảnh báo + không việc cần xử lý): khối ③/④ hiển thị dòng "Hôm nay mọi thứ ổn, không có việc gấp."
- `sendMorningBriefing({ data, ai, preview, previewEmail })`: `to = preview ? [previewEmail] : await getManagerRecipients()`. Subject: `☀️ Báo cáo sáng <dd/mm> · Call Me Ari`. Gửi qua transporter sẵn có. Bọc try/catch (không ném).

## 7. Cron — `GET /api/cron/bao-cao-sang`
- Check `Authorization: Bearer <CRON_SECRET>` (như `cron/thong-bao`). Sai → 401.
- Nếu `process.env.EMAIL_BAO_CAO_SANG !== 'on'` → trả `{ ok:true, skipped:'disabled' }` (không gửi).
- `?preview=<email>`: gửi thử tới email đó (vẫn cần CRON_SECRET) — để test trước khi bật cron thật.
- Luồng: `data = thuThapDuLieuBaoCao` → `ai = taoNhanDinhAI(data)` (null nếu lỗi) → `sendMorningBriefing`. Try/catch từng phần, trả JSON kết quả.

## 8. Edge cases / an toàn
- AI lỗi/không key → email vẫn gửi (không có khối AI).
- 1 query lỗi → log, phần đó để trống/0, vẫn gửi.
- Không có người nhận hợp lệ → bỏ qua, log.
- Số chia 0 (avgChiNgay=0, target=0) → `soNgayConTru=null` / `pctDat=0` (đã có `phanTramDat`).
- KHÔNG ném lỗi ra ngoài cron (luôn trả 200 + JSON).

## 9. Testing
- Unit (Vitest): `buildMorningBriefingHTML(data, ai)` — (a) chứa "Tiền đang có" + số đã format; (b) `ai=null` → không có khối nhận định/đề xuất nhưng vẫn có số liệu; (c) ngày yên ả → có dòng "mọi thứ ổn". `formatTrieu` các mốc (1.234.567 → "1,2tr"; <1tr; số 0).
- Verify: `npm test` + `npm run build` pass.
- Không test được tự động (cần thao tác tay sau khi deploy): gọi thật Claude API (cần key), gửi email thật (cần SMTP), cron Vercel fire. → Dùng `?preview=<email>` gửi thử 1 lần.

## 10. Việc người dùng phải tự làm (ngoài code)
- Thêm `ANTHROPIC_API_KEY` vào Vercel env + `.env` local.
- Đặt `EMAIL_BAO_CAO_SANG=on` trên Vercel khi muốn bật (mặc định off → không gửi).
- Đảm bảo `APP_URL`, `SMTP_*`, `CRON_SECRET` đã đúng trên Vercel (đã có sẵn).
- Deploy để Vercel đăng ký cron mới; gọi thử `?preview=<email>` trước khi để chạy tự động.

## 11. Ngoài phạm vi (YAGNI)
- UI toggle / bảng settings trong DB (dùng env, đồng nhất hiện trạng).
- Tùy biến nội dung theo từng người nhận (gửi cùng 1 email cho cả Owner + Manager).
- Lưu lịch sử email đã gửi.
