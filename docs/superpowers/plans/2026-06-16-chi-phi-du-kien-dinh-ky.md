# Chi phí dự kiến & Tự động hóa phiếu định kỳ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho chủ shop thấy "chi phí dự kiến cả tháng" (đã chi + khoản cố định còn lại) ở Tổng quan / Báo cáo / Email, và tự động sinh phiếu định kỳ đầu tháng — để số liệu & dự báo không bị méo giữa tháng.

**Architecture:** Giữ nguyên invariant §4 (đã-chi = tiền mặt). Thêm một lớp phái sinh `getChiPhiDuKienThang` tính từ phiếu chưa trả. Tách logic tạo phiếu định kỳ thành lib dùng chung cho cả nút tay lẫn cron ngày 1. Sửa lỗi đếm trùng trong `getDuBao` khi mẫu định kỳ đã thành phiếu thật.

**Tech Stack:** Next.js 16 (App Router) + React 19, JavaScript thuần, Prisma 7 (`$queryRaw` + `pg`), Vitest, Tailwind v4 + CSS Modules. Verify bằng `npm run build` (KHÔNG dùng `npm run lint` — lỗi môi trường ESLint 10).

> **Lưu ý môi trường (đọc trước):**
> - Sau khi sửa `dashboardQueries.js` / route, nếu đang chạy dev → **restart dev server** (Turbopack cache).
> - Test: `npm test` (Vitest). Build verify: `npm run build`.
> - Mọi đường dẫn tính từ `web-app/`. Git repo nằm trong `web-app/`.
> - **Không hardcode màu theme** — dùng biến `var(--success/--danger/--warning/--info)` + `-bg`, `var(--border)`, `rgba(var(--brand-brown-rgb), x)`.

---

## File Structure

| File | Trách nhiệm | Tạo/Sửa |
|---|---|---|
| `src/lib/chiPhiDuKien.test.js` | Test pure helper gộp danh mục | Tạo |
| `src/lib/dashboardQueries.js` | `getChiPhiDuKienThang` (mới) + helper pure `gomConLaiTheoDanhMuc` + sửa `getDuBao` | Sửa |
| `src/lib/dinhKy.js` | `taoPhieuDinhKyChoThang(prisma, {nam,thang,nguoiTaoId})` — logic dùng chung | Tạo |
| `src/app/api/dinh-ky/tao-thang-nay/route.js` | Đổi ruột sang gọi `taoPhieuDinhKyChoThang` | Sửa |
| `src/app/api/cron/dinh-ky/route.js` | Cron ngày 1 tạo phiếu định kỳ | Tạo |
| `vercel.json` | Thêm lịch cron (nếu còn slot) | Sửa |
| `src/app/api/dashboard/route.js` | Trả thêm `chiPhiDuKien` | Sửa |
| `src/app/api/chi-phi-du-kien/route.js` | Endpoint riêng cho trang Báo cáo | Tạo |
| `src/app/page.js` | 2 dòng phụ KPI (Chi phí, Lãi) | Sửa |
| `src/app/bao-cao/page.js` | Khối "Chi phí dự kiến sắp tới" gộp danh mục | Sửa |
| `src/app/bao-cao/bao-cao.module.css` | Style khối mới (+ print) | Sửa |
| `src/lib/morningBriefing.js` | Thu thập + hiển thị 3 field mới | Sửa |
| `src/lib/morningBriefing.test.js` | Test field mới | Sửa |
| `src/lib/aiBrief.js` | Feed 3 số mới vào prompt AI | Sửa |
| `CONTEXT.md` | Ghi đợt mới | Sửa |

---

## Task 1: Pure helper `gomConLaiTheoDanhMuc` + test

Tách phần gộp danh mục thành hàm thuần để test được (phần raw SQL của `getChiPhiDuKienThang` verify qua build/preview).

**Files:**
- Modify: `src/lib/dashboardQueries.js`
- Test: `src/lib/chiPhiDuKien.test.js`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/chiPhiDuKien.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { gomConLaiTheoDanhMuc } from './dashboardQueries';

describe('gomConLaiTheoDanhMuc', () => {
  it('gộp số tiền theo danh mục, sắp giảm dần, trả tổng', () => {
    const rows = [
      { danhMucId: 'C1', tenDanhMuc: 'Lương', soTien: 30_000_000 },
      { danhMucId: 'C2', tenDanhMuc: 'Thuê', soTien: 12_000_000 },
      { danhMucId: 'C1', tenDanhMuc: 'Lương', soTien: 5_000_000 },
    ];
    const { conLaiCoDinh, conLaiTheoDanhMuc } = gomConLaiTheoDanhMuc(rows);
    expect(conLaiCoDinh).toBe(47_000_000);
    expect(conLaiTheoDanhMuc).toEqual([
      { danhMucId: 'C1', tenDanhMuc: 'Lương', soTien: 35_000_000 },
      { danhMucId: 'C2', tenDanhMuc: 'Thuê', soTien: 12_000_000 },
    ]);
  });

  it('mảng rỗng → tổng 0, danh sách rỗng', () => {
    expect(gomConLaiTheoDanhMuc([])).toEqual({ conLaiCoDinh: 0, conLaiTheoDanhMuc: [] });
  });
});
```

- [ ] **Step 2: Chạy test cho chắc nó fail**

Run: `npm test -- chiPhiDuKien`
Expected: FAIL — `gomConLaiTheoDanhMuc is not a function` / không export.

- [ ] **Step 3: Thêm hàm vào `src/lib/dashboardQueries.js`**

Thêm vào cuối file (sau `getFunds`):

```js
/**
 * Gộp các dòng "còn lại" theo danh mục → tổng + mảng sắp giảm dần.
 * rows: [{ danhMucId, tenDanhMuc, soTien }]
 * Pure — test được (xem chiPhiDuKien.test.js).
 */
export function gomConLaiTheoDanhMuc(rows) {
  const map = {};
  for (const r of rows || []) {
    const id = r.danhMucId;
    if (!map[id]) map[id] = { danhMucId: id, tenDanhMuc: r.tenDanhMuc || '', soTien: 0 };
    map[id].soTien += Number(r.soTien || 0);
  }
  const conLaiTheoDanhMuc = Object.values(map).sort((a, b) => b.soTien - a.soTien);
  const conLaiCoDinh = conLaiTheoDanhMuc.reduce((s, d) => s + d.soTien, 0);
  return { conLaiCoDinh, conLaiTheoDanhMuc };
}
```

- [ ] **Step 4: Chạy test cho chắc nó pass**

Run: `npm test -- chiPhiDuKien`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardQueries.js src/lib/chiPhiDuKien.test.js
git commit -m "feat: them pure helper gomConLaiTheoDanhMuc + test"
```

---

## Task 2: `getChiPhiDuKienThang` (raw SQL) trong dashboardQueries

**Files:**
- Modify: `src/lib/dashboardQueries.js`

- [ ] **Step 1: Thêm hàm `getChiPhiDuKienThang`**

Thêm sau `gomConLaiTheoDanhMuc`. `daChiThang` tính y hệt `getLoiNhuanNam` (ThuChi CHI theo `ngayGiaoDich` + DeXuat `laLichSu` theo `COALESCE`) nhưng giới hạn tháng hiện tại; `conLai` = phiếu chưa trả (`thuChiId IS NULL`, `laLichSu=false`, trạng thái chờ) có `COALESCE(ngayCanThanhToan, ngayPhatSinh)` trong tháng:

```js
/**
 * Chi phí dự kiến cả tháng (tháng hiện tại) — lớp phái sinh, KHÔNG đụng invariant §4.
 *   daChiThang  : đã chi thực tế tháng (ThuChi CHI + DeXuat laLichSu) — KHỚP getLoiNhuanNam.
 *   conLaiCoDinh: Σ phiếu Chờ thanh toán/Chờ hoàn ứng (laLichSu=false, chưa thành ThuChi),
 *                 COALESCE(ngayCanThanhToan, ngayPhatSinh) trong tháng hiện tại.
 *   duKienCaThang = daChiThang + conLaiCoDinh.
 */
export async function getChiPhiDuKienThang(prisma) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [chiThuChiRows, chiLichSuRows, conLaiRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT COALESCE(SUM("soTien"), 0) AS total
      FROM "ThuChi"
      WHERE "ngayGiaoDich" >= ${startOfMonth} AND "ngayGiaoDich" < ${endOfMonth}
        AND "loaiGiaoDich" = 'CHI'
    `,
    prisma.$queryRaw`
      SELECT COALESCE(SUM("soTien"), 0) AS total
      FROM "DeXuatChiPhi"
      WHERE "laLichSu" = true
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") >= ${startOfMonth}
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") < ${endOfMonth}
    `,
    prisma.$queryRaw`
      SELECT d."danhMucId", dm."tenDanhMuc", SUM(d."soTien") AS "soTien"
      FROM "DeXuatChiPhi" d
      LEFT JOIN "DanhMuc" dm ON dm."id" = d."danhMucId"
      WHERE d."laLichSu" = false
        AND d."thuChiId" IS NULL
        AND d."trangThai" IN ('CHO_THANH_TOAN', 'CHO_HOAN_UNG')
        AND COALESCE(d."ngayCanThanhToan", d."ngayPhatSinh") >= ${startOfMonth}
        AND COALESCE(d."ngayCanThanhToan", d."ngayPhatSinh") < ${endOfMonth}
      GROUP BY d."danhMucId", dm."tenDanhMuc"
    `,
  ]);

  const daChiThang = Number(chiThuChiRows[0]?.total || 0) + Number(chiLichSuRows[0]?.total || 0);
  const { conLaiCoDinh, conLaiTheoDanhMuc } = gomConLaiTheoDanhMuc(conLaiRows);

  return {
    daChiThang: Math.round(daChiThang),
    conLaiCoDinh: Math.round(conLaiCoDinh),
    duKienCaThang: Math.round(daChiThang + conLaiCoDinh),
    conLaiTheoDanhMuc: conLaiTheoDanhMuc.map((d) => ({ ...d, soTien: Math.round(d.soTien) })),
  };
}
```

- [ ] **Step 2: Verify build (không có unit test cho phần raw SQL — theo pattern hiện có của dashboardQueries)**

Run: `npm run build`
Expected: build pass, không lỗi import/syntax.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dashboardQueries.js
git commit -m "feat: getChiPhiDuKienThang - chi phi du kien ca thang"
```

---

## Task 3: Sửa đếm trùng trong `getDuBao`

Khi mẫu định kỳ đã thành phiếu thật, không được vừa cộng phiếu chờ vừa chiếu bóng mẫu cho cùng tháng.

**Files:**
- Modify: `src/lib/dashboardQueries.js` (hàm `getDuBao`)

- [ ] **Step 1: Thêm query lấy phiếu định kỳ đã tạo trong khoảng forecast**

Trong `getDuBao`, thêm vào mảng `Promise.all` (sau `phieuDinhKyList`) một query mới — lấy mọi đề xuất `laLichSu=false`, trạng thái != HUY, có `ngayPhatSinh` trong khoảng `[today, endDate]`, để biết tháng nào / danh mục+nội dung nào đã có phiếu thật:

Tìm dòng:
```js
    prisma.phieuDinhKy.findMany({ where: { active: true }, select: { soTien: true, ngayChiTrongThang: true } }),
  ]);
```
Sửa `select` của phieuDinhKy để có thêm `danhMucId`, `noiDung`, rồi thêm query mới ngay sau nó:
```js
    prisma.phieuDinhKy.findMany({ where: { active: true }, select: { soTien: true, ngayChiTrongThang: true, danhMucId: true, noiDung: true } }),
    prisma.deXuatChiPhi.findMany({
      where: {
        laLichSu: false,
        trangThai: { not: 'HUY' },
        ngayPhatSinh: { gte: today, lte: endDateInclusive },
      },
      select: { danhMucId: true, noiDung: true, ngayPhatSinh: true },
    }),
  ]);
```
Và thêm biến nhận vào destructuring đầu `const [...] = await Promise.all([`:
```js
  const [funds, thuChiAgg, committedDeXuat, avgChiRaw, keHoachThangAgg, avgThuRaw, phieuDinhKyList, phieuDaTaoTrongKy] = await Promise.all([
```

- [ ] **Step 2: Dựng Set khoá đã-tạo + bỏ qua chiếu bóng nếu trùng**

Sau khi có `phieuDaTaoTrongKy`, trước vòng `phieuDinhKyList.forEach`, thêm:
```js
  // Set khoá "danhMucId|noiDung|YYYY-M" của các phiếu đã được tạo thật trong kỳ
  // → tháng nào đã có phiếu thật thì KHÔNG chiếu bóng mẫu định kỳ nữa (tránh đếm trùng).
  const daTaoKeys = new Set();
  phieuDaTaoTrongKy.forEach((p) => {
    const d = new Date(p.ngayPhatSinh);
    daTaoKeys.add(`${p.danhMucId}|${p.noiDung}|${d.getFullYear()}-${d.getMonth() + 1}`);
  });
```
Rồi trong vòng `phieuDinhKyList.forEach((p) => { monthsInRange.forEach(...) })`, ngay sau khi tính `targetDate`, thêm guard skip:
```js
      if (targetDate >= today && targetDate <= endDate) {
        const monthKey = `${p.danhMucId}|${p.noiDung}|${year}-${month}`;
        if (daTaoKeys.has(monthKey)) return; // đã có phiếu thật cho khoản này tháng này
        const k = dateKey(targetDate);
        committedByDay[k] = (committedByDay[k] || 0) + p.soTien;
      }
```

- [ ] **Step 3: Sửa `tongChiCommitted` để không cộng trùng mẫu đã hiện thực hoá**

Tìm:
```js
  const tongChiCommitted = committedDeXuat.reduce((s, p) => s + p.soTien, 0)
    + phieuDinhKyList.reduce((s, p) => s + p.soTien, 0);
```
Thay bằng (chỉ cộng mẫu chưa có phiếu thật tháng hiện tại — dùng cùng dedup key cho tháng của `today`):
```js
  const thisMonthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
  const tongChiCommitted = committedDeXuat.reduce((s, p) => s + p.soTien, 0)
    + phieuDinhKyList.reduce((s, p) =>
        daTaoKeys.has(`${p.danhMucId}|${p.noiDung}|${thisMonthKey}`) ? s : s + p.soTien, 0);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardQueries.js
git commit -m "fix: getDuBao khong dem trung phieu dinh ky da hien thuc hoa"
```

---

## Task 4: Tách `lib/dinhKy.js` + refactor route `tao-thang-nay`

**Files:**
- Create: `src/lib/dinhKy.js`
- Modify: `src/app/api/dinh-ky/tao-thang-nay/route.js`

- [ ] **Step 1: Tạo `src/lib/dinhKy.js`**

Copy nguyên logic vòng lặp từ route hiện tại (giữ 100% hành vi: chống trùng theo `noiDung + danhMucId + tháng`, `ngayPhatSinh = ngayCanThanhToan`, sinh `maPhieu`, ghi nhật ký). Hàm KHÔNG gửi email (route lo việc đó):

```js
// src/lib/dinhKy.js
// Logic tạo phiếu chi từ mẫu PhieuDinhKy cho 1 tháng — dùng chung cho nút tay + cron.
import { prisma as defaultPrisma } from '@/lib/prisma';
import { generateMaDeXuat } from '@/lib/generateId';
import { ghiNhatKy } from '@/lib/audit';

/**
 * Tạo phiếu định kỳ cho tháng/năm chỉ định từ các mẫu đang active.
 * Idempotent: bỏ qua mẫu đã có phiếu (cùng noiDung + danhMucId) trong tháng (trạng thái != HUY).
 * @returns {Promise<{created: {id:string, trangThai:string}[], skipped: string[]}>}
 */
export async function taoPhieuDinhKyChoThang(prisma, { nam, thang, nguoiTaoId, user }) {
  const db = prisma || defaultPrisma;
  const templates = await db.$queryRawUnsafe(
    `SELECT * FROM "PhieuDinhKy" WHERE "active" = true ORDER BY "createdAt" ASC`
  );

  const created = [];
  const skipped = [];
  if (!templates.length) return { created, skipped };

  const startOfMonth = new Date(Date.UTC(nam, thang - 1, 1));
  const startOfNext = new Date(Date.UTC(nam, thang, 1));
  const lastDay = new Date(nam, thang, 0).getDate();

  for (const tpl of templates) {
    const ngay = Math.min(tpl.ngayChiTrongThang, lastDay);
    const ngayPhatSinh = new Date(Date.UTC(nam, thang - 1, ngay));

    const existing = await db.deXuatChiPhi.findFirst({
      where: {
        noiDung: tpl.noiDung,
        danhMucId: tpl.danhMucId,
        ngayPhatSinh: { gte: startOfMonth, lt: startOfNext },
        trangThai: { not: 'HUY' },
      },
      select: { id: true },
    });
    if (existing) { skipped.push(tpl.tenMau); continue; }

    const maPhieu = await generateMaDeXuat();
    const proposal = await db.deXuatChiPhi.create({
      data: {
        maPhieu,
        ngayPhatSinh,
        danhMucId: tpl.danhMucId,
        noiDung: tpl.noiDung,
        soTien: tpl.soTien,
        nhaCungCapId: tpl.nhaCungCapId || null,
        nguonTien: tpl.nguonTien,
        trangThai: tpl.trangThaiMacDinh,
        ghiChu: tpl.ghiChu || null,
        nguoiTaoId,
        ngayCanThanhToan: ngayPhatSinh,
      },
      select: { id: true },
    });
    created.push({ id: proposal.id, trangThai: tpl.trangThaiMacDinh });

    if (user) {
      await ghiNhatKy({
        user,
        hanhDong: 'TAO',
        doiTuong: 'DE_XUAT',
        maDoiTuong: maPhieu,
        moTa: `Tạo phiếu định kỳ từ mẫu "${tpl.tenMau}" — Tháng ${thang}/${nam}`,
      });
    }
  }

  return { created, skipped };
}
```

- [ ] **Step 2: Refactor route `tao-thang-nay` gọi hàm chung**

Sửa `src/app/api/dinh-ky/tao-thang-nay/route.js` — bỏ vòng lặp inline, gọi lib. Giữ nguyên auth, parse `nam/thang`, email, message:

```js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { notifyManagersBulkChoThanhToan } from '@/lib/email';
import { taoPhieuDinhKyChoThang } from '@/lib/dinhKy';

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Chỉ OWNER/MANAGER được tạo phiếu định kỳ.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const nam = parseInt(body.nam, 10) || now.getFullYear();
    const thang = parseInt(body.thang, 10) || now.getMonth() + 1;
    if (thang < 1 || thang > 12) {
      return NextResponse.json({ error: 'Tháng không hợp lệ (1–12).' }, { status: 400 });
    }

    const { created, skipped } = await taoPhieuDinhKyChoThang(prisma, {
      nam, thang, nguoiTaoId: user.id, user,
    });

    const choThanhToanIds = created.filter((p) => p.trangThai === 'CHO_THANH_TOAN').map((p) => p.id);
    if (choThanhToanIds.length > 0) {
      await notifyManagersBulkChoThanhToan(choThanhToanIds);
    }

    const msg = `Đã tạo ${created.length} phiếu định kỳ tháng ${thang}/${nam}` +
      (skipped.length > 0 ? `. Bỏ qua ${skipped.length} mẫu đã tồn tại: ${skipped.join(', ')}.` : '.');
    return NextResponse.json({ success: true, created: created.length, skipped: skipped.length, message: msg });
  } catch (error) {
    logger.error('POST /api/dinh-ky/tao-thang-nay', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: pass. (Nút "Tạo tháng này" ở `/dinh-ky` vẫn hoạt động y như cũ.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/dinhKy.js src/app/api/dinh-ky/tao-thang-nay/route.js
git commit -m "refactor: tach lib/dinhKy taoPhieuDinhKyChoThang dung chung"
```

---

## Task 5: Cron `/api/cron/dinh-ky` + lịch Vercel

**Files:**
- Create: `src/app/api/cron/dinh-ky/route.js`
- Modify: `vercel.json`

- [ ] **Step 1: Tạo route cron**

Theo mẫu `cron/thu-thang` (check `CRON_SECRET`; `?preview=true` cho OWNER session — chỉ liệt kê mẫu, không tạo). Owner cron-call dùng `nguoiTaoId` của OWNER đầu tiên (vì cron không có session người dùng):

```js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { notifyManagersBulkChoThanhToan } from '@/lib/email';
import { notifyManagers } from '@/lib/webpush';
import { taoPhieuDinhKyChoThang } from '@/lib/dinhKy';

// GET /api/cron/dinh-ky        → Vercel Cron (Authorization: Bearer CRON_SECRET) tạo phiếu tháng này
// GET /api/cron/dinh-ky?preview=true → OWNER session: liệt kê mẫu active, KHÔNG tạo
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (isPreview) {
      const user = await getSession();
      if (!user || user.role !== 'OWNER') {
        return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
      }
      const templates = await prisma.$queryRawUnsafe(
        `SELECT "tenMau","soTien","ngayChiTrongThang","trangThaiMacDinh" FROM "PhieuDinhKy" WHERE "active" = true ORDER BY "createdAt" ASC`
      );
      return NextResponse.json({ preview: true, mauActive: templates });
    }

    if (!isCronCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const nam = now.getFullYear();
    const thang = now.getMonth() + 1;

    // Cron không có session → lấy OWNER đầu tiên làm người tạo + đối tượng ghi nhật ký
    const owner = await prisma.nhanVien.findFirst({
      where: { role: 'OWNER', trangThai: 'ACTIVE' },
      select: { id: true, hoTen: true, username: true, role: true },
    });
    if (!owner) {
      logger.error('cron/dinh-ky: không tìm thấy OWNER active');
      return NextResponse.json({ success: false, error: 'Không có OWNER active.' });
    }

    const { created, skipped } = await taoPhieuDinhKyChoThang(prisma, {
      nam, thang, nguoiTaoId: owner.id, user: owner,
    });

    // Email + Web Push — bọc riêng, lỗi không làm hỏng việc tạo phiếu
    try {
      const choThanhToanIds = created.filter((p) => p.trangThai === 'CHO_THANH_TOAN').map((p) => p.id);
      if (choThanhToanIds.length > 0) await notifyManagersBulkChoThanhToan(choThanhToanIds);
    } catch (e) { logger.error('cron/dinh-ky email', e); }

    try {
      if (created.length > 0) {
        await notifyManagers({
          title: 'Phiếu định kỳ tháng mới',
          body: `Đã tạo ${created.length} phiếu định kỳ tháng ${thang}/${nam}.`,
          url: '/de-xuat/duyet',
        });
      }
    } catch (e) { logger.error('cron/dinh-ky push', e); }

    logger.info(`cron/dinh-ky: tạo ${created.length}, bỏ qua ${skipped.length} — tháng ${thang}/${nam}`);
    return NextResponse.json({ success: true, created: created.length, skipped: skipped.length });
  } catch (error) {
    logger.error('GET /api/cron/dinh-ky', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống.' });
  }
}
```

> **Kiểm tra trước khi viết:** mở `src/lib/webpush.js` xác nhận chữ ký `notifyManagers(payload)` (payload có `title/body/url`). Nếu khác → chỉnh cho khớp. Nếu không chắc có hàm gửi-chung, bỏ khối Web Push (email là đủ) — KHÔNG bịa API.

- [ ] **Step 2: Thêm lịch cron vào `vercel.json` (KIỂM TRA SLOT TRƯỚC)**

⚠️ Đã có 4 cron. **Trước khi thêm**, xác nhận gói Vercel cho phép >4 cron (Dashboard → project → Settings → Crons, hoặc thử deploy). 
- Nếu CÒN slot: thêm vào mảng `crons` trong `vercel.json`:
```json
    {
      "path": "/api/cron/dinh-ky",
      "schedule": "0 1 1 * *"
    }
```
- Nếu HẾT slot: **bỏ qua sửa `vercel.json`**, thay vào đó mở `src/app/api/cron/thu-thang/route.js`, trong nhánh cron-call (sau khi `sendMonthlyReport` xong) gọi thêm:
```js
import { taoPhieuDinhKyChoThang } from '@/lib/dinhKy';
// ... trong GET, nhánh isCronCall && !isPreview, sau khi gửi report:
try {
  const now = new Date();
  const owner = await prisma.nhanVien.findFirst({ where: { role: 'OWNER', trangThai: 'ACTIVE' }, select: { id: true, hoTen: true, username: true, role: true } });
  if (owner) await taoPhieuDinhKyChoThang(prisma, { nam: now.getFullYear(), thang: now.getMonth() + 1, nguoiTaoId: owner.id, user: owner });
} catch (e) { logger.error('thu-thang: tao phieu dinh ky', e); }
```
(thu-thang đã chạy `0 1 1 * *` đúng ngày 1, và `prisma` đã import sẵn ở đó? Nếu chưa, thêm `import { prisma } from '@/lib/prisma';`.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: pass. Route `api/cron/dinh-ky` xuất hiện trong danh sách routes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/dinh-ky/route.js vercel.json
git commit -m "feat: cron tu tao phieu dinh ky ngay 1"
```

---

## Task 6: Surface `chiPhiDuKien` ở `/api/dashboard` + endpoint riêng cho Báo cáo

**Files:**
- Modify: `src/app/api/dashboard/route.js`
- Create: `src/app/api/chi-phi-du-kien/route.js`

- [ ] **Step 1: Thêm `getChiPhiDuKienThang` vào `/api/dashboard`**

Trong `src/app/api/dashboard/route.js`:
1. Sửa import dòng 6 thêm `getChiPhiDuKienThang`:
```js
import { getLoiNhuanNam, getCanhBao, getThongKeThang, getDuBao, getFunds, getChiPhiDuKienThang } from '@/lib/dashboardQueries';
```
2. Thêm phần tử cuối mảng `Promise.allSettled` (sau query doanh thu mini, là phần tử index 12), gate bằng `seeInsights`:
```js
      // Chi phí dự kiến cả tháng (OWNER/MANAGER — cùng quyền KPI tài chính)
      seeInsights ? getChiPhiDuKienThang(prisma) : Promise.resolve(null),
```
3. Thêm `const chiPhiDuKien = pick(12);` sau dòng `const doanhThuData = pick(11);`.
4. Thêm `chiPhiDuKien,` vào object `NextResponse.json({ ... })`.

- [ ] **Step 2: Tạo endpoint riêng cho trang Báo cáo**

`src/app/api/chi-phi-du-kien/route.js`:
```js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getChiPhiDuKienThang } from '@/lib/dashboardQueries';

// GET /api/chi-phi-du-kien — OWNER/MANAGER: chi phí dự kiến cả tháng hiện tại (gộp danh mục).
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }
    const data = await getChiPhiDuKienThang(prisma);
    return NextResponse.json(data);
  } catch (error) {
    logger.error('GET /api/chi-phi-du-kien', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: pass. Cả 2 route build OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dashboard/route.js src/app/api/chi-phi-du-kien/route.js
git commit -m "feat: expose chiPhiDuKien qua /api/dashboard + endpoint rieng"
```

---

## Task 7: Dashboard — 2 dòng phụ KPI (Chi phí, Lãi)

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Thêm state + nhận dữ liệu**

Sau dòng `const [duBao, setDuBao] = useState(null);` (≈ dòng 58) thêm:
```js
  const [chiPhiDuKien, setChiPhiDuKien] = useState(null);
```
Trong `fetchDashboard`, sau khối `if (data.duBao !== null) setDuBao(data.duBao);` (≈ dòng 139) thêm:
```js
      if (data.chiPhiDuKien != null) setChiPhiDuKien(data.chiPhiDuKien);
```

- [ ] **Step 2: Tính số dẫn xuất gần khu KPI tháng**

Sau dòng `const bienLoiNhuan = ...` (≈ dòng 321) thêm:
```js
  const conLaiCoDinh = chiPhiDuKien?.conLaiCoDinh || 0;
  const duKienCaThang = chiPhiDuKien ? chiPhiDuKien.duKienCaThang : chiPhiThang;
  const laiDuKienCaThang = doanhThuThang - duKienCaThang;
```

- [ ] **Step 3: Thêm dòng phụ vào thẻ "Chi phí tháng này"**

Trong card Chi phí (≈ dòng 812-814), thay `<p className={styles.cardInfo}>...</p>` bằng — giữ dòng kế hoạch cũ, thêm dòng dự kiến khi `conLaiCoDinh > 0`:
```jsx
                <p className={styles.cardInfo}>
                  {chiPhiKeHoachThang > 0 ? `${tileChiPhi}% kế hoạch (${formatVND(chiPhiKeHoachThang)})` : 'Chưa đặt kế hoạch chi tháng'}
                </p>
                {conLaiCoDinh > 0 && (
                  <p className={styles.cardInfo} style={{ marginTop: '0.15rem' }}>
                    đã chi {formatVND(chiPhiThang)} · dự kiến thêm ~{formatVND(conLaiCoDinh)} → ước cả tháng ~{formatVND(duKienCaThang)}
                  </p>
                )}
```

- [ ] **Step 4: Thêm dòng phụ vào thẻ "Lãi/Lỗ tháng"**

Trong card Lãi/Lỗ (≈ dòng 826), sau `<p className={styles.cardInfo}>Biên lợi nhuận ...</p>` thêm khi có dữ liệu dự kiến:
```jsx
                {conLaiCoDinh > 0 && (
                  <p className={styles.cardInfo} style={{ marginTop: '0.15rem', color: laiDuKienCaThang >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    Lãi ước cả tháng ~{formatVND(laiDuKienCaThang)}
                  </p>
                )}
```

- [ ] **Step 5: Verify build + mắt thường**

Run: `npm run build`
Expected: pass. (Tùy chọn) `npm run dev`, đăng nhập OWNER, kiểm tra 2 dòng phụ hiện đúng khi có phiếu chờ thanh toán trong tháng.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.js
git commit -m "feat: dashboard hien chi phi/lai du kien ca thang"
```

---

## Task 8: Báo cáo — khối "Chi phí dự kiến sắp tới" (gộp danh mục)

**Files:**
- Modify: `src/app/bao-cao/page.js`
- Modify: `src/app/bao-cao/bao-cao.module.css`

- [ ] **Step 1: State + fetch**

Sau `const [loiNhuanLoading, setLoiNhuanLoading] = useState(false);` (≈ dòng 63) thêm:
```js
  const [chiPhiDuKien, setChiPhiDuKien] = useState(null);
```
Thêm một `useEffect` tải dữ liệu khi có user OWNER/MANAGER (đặt cạnh các effect tải dữ liệu khác):
```js
  useEffect(() => {
    if (!user) return;
    fetch('/api/chi-phi-du-kien')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setChiPhiDuKien(d); })
      .catch(() => {});
  }, [user]);
```
> Kiểm tra cách trang lấy `user` (thường `fetch('/api/auth/me')` set `setUser`). Effect chỉ chạy lại khi `user` đổi.

- [ ] **Step 2: Render khối (đặt cạnh các khối báo cáo khác, ví dụ sau khối cơ cấu chi)**

Dùng `formatVND` của trang (kiểm tra tên hàm format tiền trong file — nếu là helper khác, dùng đúng tên đó). Khối:
```jsx
        {chiPhiDuKien && chiPhiDuKien.conLaiCoDinh > 0 && (
          <div className={`glass-card ${styles.duKienCard}`}>
            <h3 className={styles.duKienTitle}>Chi phí dự kiến sắp tới</h3>
            <p className={styles.duKienNote}>
              Các khoản cố định / đang chờ trả còn lại trong tháng — chưa tính vào “đã chi”.
            </p>
            <table className="custom-table">
              <thead>
                <tr><th>Danh mục</th><th style={{ textAlign: 'right' }}>Số tiền</th></tr>
              </thead>
              <tbody>
                {chiPhiDuKien.conLaiTheoDanhMuc.map((d) => (
                  <tr key={d.danhMucId}>
                    <td>{d.tenDanhMuc || '(Chưa rõ danh mục)'}</td>
                    <td style={{ textAlign: 'right' }}>{formatVND(d.soTien)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Tổng dự kiến còn lại</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{formatVND(chiPhiDuKien.conLaiCoDinh)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
```
> Nếu file không có hàm `formatVND`, dùng hàm format hiện hành của trang (grep `toLocaleString` / `formatVND` trong `bao-cao/page.js`).

- [ ] **Step 3: Style trong `bao-cao.module.css`**

Thêm (chỉ dùng biến theme, không hardcode màu):
```css
.duKienCard { margin-bottom: 1.25rem; padding: 1rem 1.1rem; }
.duKienTitle { font-size: 1rem; font-weight: 700; margin: 0 0 0.25rem; }
.duKienNote { font-size: 0.82rem; color: var(--text-muted); margin: 0 0 0.75rem; }
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: pass. Khối hiện khi có phiếu chờ trả trong tháng; ẩn khi không. In thử (`window.print` qua nút "In báo cáo") — khối nằm trong vùng in.

- [ ] **Step 5: Commit**

```bash
git add src/app/bao-cao/page.js src/app/bao-cao/bao-cao.module.css
git commit -m "feat: bao-cao them khoi chi phi du kien sap toi (gop danh muc)"
```

---

## Task 9: Email "Báo cáo sáng" — 3 field mới + AI

**Files:**
- Modify: `src/lib/morningBriefing.js`
- Modify: `src/lib/morningBriefing.test.js`
- Modify: `src/lib/aiBrief.js`

- [ ] **Step 1: Viết test thất bại cho HTML field mới**

Trong `src/lib/morningBriefing.test.js`, thêm test (giữ style các test sẵn có — kiểm tra chuỗi xuất hiện trong HTML):
```js
import { describe, it, expect } from 'vitest';
import { buildMorningBriefingHTML } from './morningBriefing';

function baseData(over = {}) {
  return {
    ngay: new Date('2026-06-16'),
    tien: { tongTien: 12_000_897, quyList: [], soNgayConTru: 8, canhBaoAm: false, ngayCoTheAm: null },
    hieuSuat: {
      doanhThuThang: 182_000_000, mucTieuThang: 400_000_000, pctDat: 46,
      chiPhiThang: 84_000_000, laiThang: 98_000_000, doanhThuHomQua: 21_000_000,
      chiPhiDuKienThang: 144_000_000, conLaiCoDinh: 60_000_000, laiDuKienThang: 38_000_000,
      ...over,
    },
    canXuLy: { choThanhToan: { count: 0, tong: 0 }, choHoanUng: { count: 0, tong: 0 }, quaHan: { count: 0, tong: 0 }, chuaNhapDoanhThu: { soKenh: 0 } },
    canhBao: { nhacHan: [], vuotHanMuc: [], vuotKeHoach: [], tongSo: 0 },
  };
}

describe('morningBriefing — chi phí dự kiến', () => {
  it('hiện "dự kiến cả tháng" khi conLaiCoDinh > 0', () => {
    const html = buildMorningBriefingHTML(baseData(), null);
    expect(html).toContain('dự kiến cả tháng');
  });
  it('ẩn dòng dự kiến khi conLaiCoDinh = 0', () => {
    const html = buildMorningBriefingHTML(baseData({ conLaiCoDinh: 0 }), null);
    expect(html).not.toContain('dự kiến cả tháng');
  });
});
```

- [ ] **Step 2: Chạy test cho chắc fail**

Run: `npm test -- morningBriefing`
Expected: FAIL — HTML chưa có chuỗi "dự kiến cả tháng".

- [ ] **Step 3: Thu thập dữ liệu mới trong `thuThapDuLieuBaoCao`**

Trong `src/lib/morningBriefing.js`:
1. Sửa import dòng 6 thêm `getChiPhiDuKienThang`:
```js
import { getFunds, getDuBao, getLoiNhuanNam, getCanhBao, getChiPhiDuKienThang } from './dashboardQueries';
```
2. Thêm `getChiPhiDuKienThang(prisma)` vào `Promise.all` (thêm biến `chiPhiDuKien` cuối destructuring):
```js
  const [funds, duBao, loiNhuan, canhBao, dtHomQua, choTT, choHU, quaHan, kenhActive, dtYesterdayRows, chiPhiDuKien] =
    await Promise.all([
      // ... các phần tử cũ ...
      prisma.doanhThuHangNgay.findMany({ where: { ngay: startYesterday }, select: { kenhBanId: true } }),
      getChiPhiDuKienThang(prisma),
    ]);
```
3. Trong object trả về, bổ sung 3 field vào `hieuSuat`:
```js
    hieuSuat: {
      doanhThuThang,
      mucTieuThang,
      pctDat: phanTramDat(doanhThuThang, mucTieuThang),
      chiPhiThang,
      laiThang,
      doanhThuHomQua: Number(dtHomQua?._sum?.soTien || 0),
      chiPhiDuKienThang: chiPhiDuKien?.duKienCaThang || chiPhiThang,
      conLaiCoDinh: chiPhiDuKien?.conLaiCoDinh || 0,
      laiDuKienThang: doanhThuThang - (chiPhiDuKien?.duKienCaThang || chiPhiThang),
    },
```

- [ ] **Step 4: Hiện trong HTML**

Trong `buildMorningBriefingHTML`, sửa 2 ô metric. Hàm `metricCell(label, value, sub, subColor)` đã hỗ trợ `sub`. Đổi 2 dòng:
```js
      ${metricCell('Chi phí tháng', formatTrieu(h.chiPhiThang), h.conLaiCoDinh > 0 ? `dự kiến cả tháng ~${formatTrieu(h.chiPhiDuKienThang)}` : null)}
```
và
```js
      ${metricCell('Lãi tạm tính', (h.laiThang >= 0 ? '+' : '') + formatTrieu(h.laiThang), h.conLaiCoDinh > 0 ? `ước cả tháng ~${formatTrieu(h.laiDuKienThang)}` : null, h.laiThang >= 0 ? C.good : C.danger)}
```

- [ ] **Step 5: Chạy test cho chắc pass**

Run: `npm test -- morningBriefing`
Expected: PASS (gồm 2 test mới + test cũ không vỡ).

- [ ] **Step 6: Feed AI trong `aiBrief.js`**

Trong `summarizeForAI` (sau `lai_tam_tinh_thang`) thêm:
```js
    chi_phi_du_kien_ca_thang: h.chiPhiDuKienThang,
    chi_phi_co_dinh_con_lai: h.conLaiCoDinh,
    lai_du_kien_ca_thang: h.laiDuKienThang,
```
Trong hằng `SYSTEM`, thêm 1 gạch đầu dòng chỉ thị:
```
- LƯU Ý dòng tiền theo kỳ: nếu "chi_phi_co_dinh_con_lai" > 0, ĐỪNG kết luận lời/lỗ dựa trên "lai_tam_tinh_thang"; hãy nói theo "lai_du_kien_ca_thang" và nhắc còn khoản cố định (lương/thuê...) chưa chi trong tháng.
```

- [ ] **Step 7: Verify build + test**

Run: `npm run build && npm test`
Expected: build pass; toàn bộ test pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/morningBriefing.js src/lib/morningBriefing.test.js src/lib/aiBrief.js
git commit -m "feat: email bao cao sang them chi phi/lai du kien + AI nhan dinh dung ky"
```

---

## Task 10: Verify tổng thể + cập nhật CONTEXT.md

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Verify cuối**

Run: `npm run build`
Expected: build pass (tăng số pages do thêm 2 route mới).
Run: `npm test`
Expected: tất cả test pass.

- [ ] **Step 2: (Tùy chọn) test cron preview**

Chạy dev, đăng nhập OWNER, mở `http://localhost:3000/api/cron/dinh-ky?preview=true` → JSON `{ preview: true, mauActive: [...] }`, KHÔNG tạo phiếu.

- [ ] **Step 3: Cập nhật CONTEXT.md**

Thêm mục đợt mới ở `CONTEXT.md` §5 (đầu danh sách), tóm tắt: chi phí dự kiến cả tháng (lớp phái sinh, không đụng §4) + cron tự tạo phiếu định kỳ ngày 1 + sửa đếm trùng `getDuBao` + hiển thị Dashboard/Báo cáo/Email + AI nhận định theo lãi ước cả tháng. Ghi rõ files đụng + "build + test pass".

- [ ] **Step 4: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: cap nhat CONTEXT cho dot chi phi du kien + auto dinh ky"
```

---

## Self-Review (đã rà)

- **Spec coverage:** §4.1 (không đổi schema) ✓ tự nhiên; §4.2 lib chung → Task 4; §4.3 cron + slot fallback → Task 5; §4.4 getChiPhiDuKienThang → Task 1-2; §4.5 fix double-count → Task 3; §4.6a/b dashboard → Task 7; §4.6c báo cáo → Task 8; §4.6d email+AI → Task 9; §7 verify → Task 10. Không gap.
- **Type/tên nhất quán:** `getChiPhiDuKienThang` trả `{daChiThang, conLaiCoDinh, duKienCaThang, conLaiTheoDanhMuc}` — dùng đúng tên ở Task 6/7/8/9. `taoPhieuDinhKyChoThang(prisma, {nam,thang,nguoiTaoId,user})` trả `{created:[{id,trangThai}], skipped:[]}` — dùng đúng ở route + cron. `gomConLaiTheoDanhMuc` dùng ở Task 1 + 2.
- **Điểm cần kiểm tra khi code (không bịa API):** chữ ký `notifyManagers` trong `webpush.js` (Task 5); tên hàm format tiền trong `bao-cao/page.js` (Task 8); cách set `user` ở `bao-cao/page.js` (Task 8). Đã ghi chú inline.
- **Rủi ro còn lại:** slot cron Vercel (Task 5 Step 2 có nhánh dự phòng gắn vào `thu-thang`).
