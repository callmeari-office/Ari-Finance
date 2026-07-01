# Người Đề Xuất (tách khỏi Người Tạo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người tạo phiếu đề xuất chi phí chọn một "người đề xuất" khác (NV cùng phòng ban / cấp dưới) để tạo giúp — tách khỏi "người tạo" (ai bấm nút tạo), mà không phá vỡ audit trail hay quyền hạn hiện có.

**Architecture:** Thêm cột `nguoiDeXuatId` (luôn có giá trị, mặc định = `nguoiTaoId`) vào `DeXuatChiPhi`. Mọi logic "chủ sở hữu nghiệp vụ" (ai xem được, ai đang chờ hoàn ứng, thống kê theo người, notification) chuyển sang đọc `nguoiDeXuatId`. Mọi logic "quyền sửa/hủy" (ai được sửa) giữ nguyên theo `nguoiTaoId`. Không cần fallback `??` ở bất kỳ đâu vì cột luôn được set khi tạo phiếu.

**Tech Stack:** Next.js 16 App Router, JS thuần (không TS), Prisma 7 + `@prisma/adapter-pg`, PostgreSQL (Supabase), Vitest.

---

## File Structure

| File | Vai trò |
|---|---|
| `prisma/schema.prisma` | Thêm field `nguoiDeXuatId` + relation `NguoiDeXuat` |
| `prisma/add-nguoi-de-xuat.sql` (mới) | Migration: thêm cột, backfill, NOT NULL, FK, index |
| `prisma/MIGRATIONS.md` | Ghi nhật ký migration |
| `src/lib/roles.js` | Thêm `ROLE_RANK` + `canChonLamNguoiDeXuat()` (pure, test được) |
| `src/lib/roles.test.js` | Test cho `canChonLamNguoiDeXuat()` |
| `src/app/api/nhan-su/route.js` | Thêm `scope=tao-giup` — danh sách NV được phép chọn làm người đề xuất |
| `src/app/api/de-xuat/route.js` | POST nhận `nguoiDeXuatId`; GET đổi filter theo `nguoiDeXuatId`, đổi include |
| `src/app/api/de-xuat/[id]/route.js` | GET (xem chi tiết) đổi sang OR-check; DUYET đổi người nhận notify |
| `src/app/api/dashboard/route.js` | Đổi where + include cho widget cá nhân STAFF/LEADER |
| `src/lib/dashboardQueries.js` | `getDeXuatTheoNguoiThang` group theo `nguoiDeXuat` |
| `src/app/api/de-xuat/duyet-gop/route.js` | Validate/group/notify theo `nguoiDeXuatId` |
| `src/app/api/de-xuat/duyet-nhieu/route.js` | Group/notify theo `nguoiDeXuatId` |
| `src/app/de-xuat/page.js` | Form "Tạo giúp cho người khác" + hiển thị danh sách/chi tiết + đổi tên filter |
| `src/app/de-xuat/duyet/page.js` | Đổi grouping TH1/TH2/TH3 + hiển thị theo `nguoiDeXuat` |
| `CONTEXT.md` | Ghi lại tính năng mới sau khi hoàn thành |

---

### Task 1: Schema + Migration

**Files:**
- Modify: `web-app/prisma/schema.prisma:9-29` (model NhanVien), `:163-197` (model DeXuatChiPhi)
- Create: `web-app/prisma/add-nguoi-de-xuat.sql`
- Modify: `web-app/prisma/MIGRATIONS.md`

- [ ] **Step 1: Thêm field vào `DeXuatChiPhi` trong schema.prisma**

Trong `model DeXuatChiPhi` (dòng 163-197), thêm field và relation ngay sau `nguoiTaoId`:

```prisma
model DeXuatChiPhi {
  id               String      @id @default(uuid())
  maPhieu          String      @unique
  ngayPhatSinh     DateTime
  danhMucId        String
  noiDung          String
  soTien           Float
  nhaCungCapId     String?
  anhHoaDon        String?
  nguonTien        String
  trangThai        String
  quyThanhToanId   String?
  thuChiId         String?
  nguoiTaoId       String
  nguoiDeXuatId    String
  ngayThanhToan    DateTime?
  nguoiDuyetId     String?
  ghiChu           String?
  ngayTao          DateTime    @default(now())
  ngayCanThanhToan DateTime?
  laLichSu         Boolean     @default(false)


  danhMuc         DanhMuc     @relation(fields: [danhMucId], references: [id])
  nhaCungCap      NhaCungCap? @relation(fields: [nhaCungCapId], references: [id])
  quyThanhToan    Quy?        @relation(fields: [quyThanhToanId], references: [id])
  thuChi          ThuChi?     @relation(fields: [thuChiId], references: [id], onDelete: SetNull)
  nguoiTao        NhanVien    @relation("NguoiTao", fields: [nguoiTaoId], references: [id])
  nguoiDeXuat     NhanVien    @relation("NguoiDeXuat", fields: [nguoiDeXuatId], references: [id])
  nguoiDuyet      NhanVien?   @relation("NguoiDuyet", fields: [nguoiDuyetId], references: [id])

  @@index([trangThai])
  @@index([ngayPhatSinh])
  @@index([nguoiTaoId])
  @@index([nguoiDeXuatId])
  @@index([danhMucId])
  @@index([ngayCanThanhToan])
}
```

- [ ] **Step 2: Thêm relation ngược trong `model NhanVien` (dòng 9-29)**

Thay dòng 25 (`deXuatTao DeXuatChiPhi[] @relation("NguoiTao")`) — giữ nguyên dòng đó, thêm 1 dòng mới ngay dưới:

```prisma
  deXuatTao           DeXuatChiPhi[] @relation("NguoiTao")
  deXuatDuocDeXuat    DeXuatChiPhi[] @relation("NguoiDeXuat")
  deXuatDuyet         DeXuatChiPhi[] @relation("NguoiDuyet")
```

- [ ] **Step 3: Tạo file migration SQL**

Tạo `web-app/prisma/add-nguoi-de-xuat.sql`:

```sql
-- Migration: thêm cột nguoiDeXuatId vào DeXuatChiPhi
-- Mục đích: tách "người đề xuất" (chủ sở hữu nghiệp vụ khoản chi — dùng cho
-- quyền xem, hoàn ứng, thống kê, thông báo) khỏi "người tạo" (nguoiTaoId —
-- ai bấm nút tạo, giữ nguyên ý nghĩa audit). Cho phép tạo giúp phiếu cho NV khác.
-- Chạy: npx prisma db execute --file ./prisma/add-nguoi-de-xuat.sql

ALTER TABLE "DeXuatChiPhi" ADD COLUMN IF NOT EXISTS "nguoiDeXuatId" TEXT;

-- Backfill dữ liệu cũ: người đề xuất = người tạo (chưa từng có khái niệm tạo giúp)
UPDATE "DeXuatChiPhi" SET "nguoiDeXuatId" = "nguoiTaoId" WHERE "nguoiDeXuatId" IS NULL;

ALTER TABLE "DeXuatChiPhi" ALTER COLUMN "nguoiDeXuatId" SET NOT NULL;

ALTER TABLE "DeXuatChiPhi"
  ADD CONSTRAINT "DeXuatChiPhi_nguoiDeXuatId_fkey"
    FOREIGN KEY ("nguoiDeXuatId") REFERENCES "NhanVien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "DeXuatChiPhi_nguoiDeXuatId_idx" ON "DeXuatChiPhi"("nguoiDeXuatId");
```

- [ ] **Step 4: Chạy generate + migration + restart dev server**

```bash
npx prisma generate
npx prisma db execute --file ./prisma/add-nguoi-de-xuat.sql
npm run db:check
```

Sau đó **restart dev server** (Turbopack cache Prisma client cũ — quy tắc bắt buộc trong `.claude/rules/coding-style.md`).

- [ ] **Step 5: Ghi vào `MIGRATIONS.md`**

Thêm dòng vào bảng "Đã áp dụng" (đầu bảng, sau dòng header):

```markdown
| 2026-07-01 | `add-nguoi-de-xuat.sql` | Thêm cột `DeXuatChiPhi.nguoiDeXuatId` (tách "người đề xuất" khỏi "người tạo") | ✅ Đã chạy |
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/add-nguoi-de-xuat.sql prisma/MIGRATIONS.md
git commit -m "feat(db): them cot nguoiDeXuatId cho DeXuatChiPhi"
```

---

### Task 2: Helper phân quyền chọn người đề xuất (TDD)

**Files:**
- Modify: `web-app/src/lib/roles.js`
- Modify: `web-app/src/lib/roles.test.js`

- [ ] **Step 1: Viết test trước (thêm vào cuối `roles.test.js`)**

```js
describe('canChonLamNguoiDeXuat', () => {
  it('OWNER chon duoc bat ky ai ACTIVE, khac phong ban van duoc', () => {
    const nguoiTao = { role: 'OWNER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'MARKETING', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('MANAGER chon duoc STAFF cung phong ban', () => {
    const nguoiTao = { role: 'MANAGER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('MANAGER khong chon duoc NV khac phong ban', () => {
    const nguoiTao = { role: 'MANAGER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'MARKETING', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(false);
  });

  it('STAFF khong chon duoc cap tren (MANAGER) cung phong ban', () => {
    const nguoiTao = { role: 'STAFF', phongBan: 'FINANCE' };
    const target = { role: 'MANAGER', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(false);
  });

  it('STAFF chon duoc STAFF khac cung cap, cung phong ban', () => {
    const nguoiTao = { role: 'STAFF', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'ACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(true);
  });

  it('khong chon duoc NV INACTIVE', () => {
    const nguoiTao = { role: 'MANAGER', phongBan: 'FINANCE' };
    const target = { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'INACTIVE' };
    expect(canChonLamNguoiDeXuat(nguoiTao, target)).toBe(false);
  });

  it('thieu nguoiTao hoac target -> false', () => {
    expect(canChonLamNguoiDeXuat(null, { role: 'STAFF', phongBan: 'FINANCE', trangThai: 'ACTIVE' })).toBe(false);
    expect(canChonLamNguoiDeXuat({ role: 'OWNER', phongBan: 'FINANCE' }, null)).toBe(false);
  });
});
```

Và thêm `canChonLamNguoiDeXuat` vào import ở đầu file (dòng 2-9):

```js
import {
  getEffectiveRoles,
  canViewCategory,
  isRestrictedToOwnProposals,
  canUseProposalCreatorFilter,
  defaultMenuAllowed,
  canViewMenu,
  canChonLamNguoiDeXuat,
} from './roles';
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npm run test -- roles.test.js`
Expected: FAIL — `canChonLamNguoiDeXuat is not defined` (chưa export từ `roles.js`).

- [ ] **Step 3: Viết implementation trong `roles.js`**

Thêm vào cuối file `web-app/src/lib/roles.js` (sau hàm `canViewMenu`, dòng 145):

```js

/**
 * Thứ hạng vai trò dùng để giới hạn "tạo giúp cho người khác" — người tạo
 * chỉ được chọn người đề xuất có hạng <= hạng của chính mình (không chọn cấp trên).
 */
export const ROLE_RANK = { OWNER: 4, MANAGER: 3, LEADER: 2, STAFF: 1 };

/**
 * Người tạo (`nguoiTao`, dạng { role, phongBan }) có được chọn `target`
 * (dạng { role, phongBan, trangThai }) làm "người đề xuất" khi tạo giúp không?
 * - target phải ACTIVE.
 * - target không được có role cao hơn nguoiTao.
 * - Phải cùng phòng ban, TRỪ khi nguoiTao là OWNER (không giới hạn phòng ban).
 */
export function canChonLamNguoiDeXuat(nguoiTao, target) {
  if (!nguoiTao || !target) return false;
  if (target.trangThai !== 'ACTIVE') return false;
  const rankNguoiTao = ROLE_RANK[nguoiTao.role] || 0;
  const rankTarget = ROLE_RANK[target.role] || 0;
  if (rankTarget > rankNguoiTao) return false;
  if (nguoiTao.role !== 'OWNER' && target.phongBan !== nguoiTao.phongBan) return false;
  return true;
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm run test -- roles.test.js`
Expected: PASS — toàn bộ describe blocks xanh.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roles.js src/lib/roles.test.js
git commit -m "feat(roles): them canChonLamNguoiDeXuat de gioi han tao giup"
```

---

### Task 3: API endpoint lấy danh sách "người đề xuất" hợp lệ

**Files:**
- Modify: `web-app/src/app/api/nhan-su/route.js:1-39`

- [ ] **Step 1: Thêm scope mới `tao-giup` vào `GET`**

Thêm import `canChonLamNguoiDeXuat` (dòng 7, sửa thành):

```js
import { canUseProposalCreatorFilter, canChonLamNguoiDeXuat } from '@/lib/roles';
```

Thêm block xử lý ngay sau block `scope === 'proposal-filter'` (sau dòng 39, trước `if (!checkRole(user, ['OWNER']))`):

```js
    if (scope === 'tao-giup') {
      const allActive = await prisma.nhanVien.findMany({
        where: { trangThai: 'ACTIVE' },
        orderBy: [{ role: 'asc' }, { hoTen: 'asc' }],
        select: {
          id: true,
          hoTen: true,
          tenNgan: true,
          role: true,
          phongBan: true,
          trangThai: true,
        },
      });

      const eligible = allActive
        .filter((nv) => nv.id !== user.id)
        .filter((nv) => canChonLamNguoiDeXuat(user, nv))
        .map(({ id, hoTen, tenNgan, role }) => ({ id, hoTen, tenNgan, role }));

      return NextResponse.json(eligible);
    }

```

- [ ] **Step 2: Verify bằng build**

Run: `npm run build`
Expected: build thành công, không lỗi cú pháp trong `api/nhan-su/route.js`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/nhan-su/route.js
git commit -m "feat(api): them scope=tao-giup cho danh sach nguoi de xuat hop le"
```

---

### Task 4: API tạo đề xuất — nhận `nguoiDeXuatId`

**Files:**
- Modify: `web-app/src/app/api/de-xuat/route.js:178-281`

- [ ] **Step 1: Đổi import (dòng 9)**

```js
import { canViewCategory, isRestrictedToOwnProposals, getEffectiveRoles, canChonLamNguoiDeXuat } from '@/lib/roles';
```

- [ ] **Step 2: Nhận thêm `nguoiDeXuatId` từ body (dòng 186-197)**

```js
    const body = await request.json();
    const {
      ngayPhatSinh,
      danhMucId,
      noiDung,
      soTien,
      nhaCungCapId,
      nguonTien,
      trangThai,
      ghiChu,
      ngayCanThanhToan,
      anhHoaDon,
      nguoiDeXuatId,
    } = body;
```

- [ ] **Step 3: Validate + xác định `nguoiDeXuatId` cuối cùng — chèn ngay trước dòng `const newProposal = await withUniqueCodeRetry(...)` (trước dòng 260)**

```js
    let finalNguoiDeXuatId = user.id;
    if (nguoiDeXuatId && nguoiDeXuatId !== user.id) {
      const target = await prisma.nhanVien.findUnique({ where: { id: nguoiDeXuatId } });
      if (!target || !canChonLamNguoiDeXuat(user, target)) {
        return NextResponse.json(
          { error: 'Bạn không có quyền tạo giúp phiếu đề xuất cho người này.' },
          { status: 403 }
        );
      }
      finalNguoiDeXuatId = target.id;
    }

```

- [ ] **Step 4: Set field khi tạo (dòng 274, thêm `nguoiDeXuatId` ngay dưới `nguoiTaoId: user.id,`)**

```js
          nguoiTaoId: user.id,
          nguoiDeXuatId: finalNguoiDeXuatId,
```

- [ ] **Step 5: Verify bằng build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/de-xuat/route.js
git commit -m "feat(api): POST /api/de-xuat nhan va validate nguoiDeXuatId"
```

---

### Task 5: API danh sách đề xuất — filter + include theo `nguoiDeXuatId`

**Files:**
- Modify: `web-app/src/app/api/de-xuat/route.js:17-138`

- [ ] **Step 1: Đổi tên query param đọc vào (dòng 30)**

```js
    const nguoiDeXuatId = searchParams.get('nguoiDeXuatId');
```

- [ ] **Step 2: Đổi điều kiện lọc quyền xem (dòng 89-94)**

Thay:
```js
    // Staff (và Leader) chỉ thấy đề xuất của mình
    if (isRestrictedToOwnProposals(user.role)) {
      where.nguoiTaoId = user.id;
    } else if (nguoiTaoId) {
      where.nguoiTaoId = { in: nguoiTaoId.split(',').map(s => s.trim()).filter(Boolean) };
    }
```

Thành:
```js
    // Staff (và Leader) chỉ thấy đề xuất liên quan tới mình — đã tạo HOẶC được tạo giúp cho.
    if (isRestrictedToOwnProposals(user.role)) {
      where.AND = [
        ...(where.AND || []),
        { OR: [{ nguoiTaoId: user.id }, { nguoiDeXuatId: user.id }] },
      ];
    } else if (nguoiDeXuatId) {
      where.nguoiDeXuatId = { in: nguoiDeXuatId.split(',').map(s => s.trim()).filter(Boolean) };
    }
```

- [ ] **Step 3: Thêm include `nguoiDeXuat` (dòng 132-138)**

```js
    const include = {
      danhMuc: { include: { nhomChiPhi: true } },
      nhaCungCap: true,
      quyThanhToan: true,
      nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true, role: true } },
      nguoiDeXuat: { select: { id: true, hoTen: true, tenNgan: true, email: true, role: true } },
      nguoiDuyet: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
    };
```

- [ ] **Step 4: Verify bằng build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/de-xuat/route.js
git commit -m "feat(api): GET /api/de-xuat loc va tra ve theo nguoiDeXuatId"
```

---

### Task 6: API chi tiết đề xuất — quyền xem theo `nguoiDeXuatId`

**Files:**
- Modify: `web-app/src/app/api/de-xuat/[id]/route.js:14-55, 294-301`

- [ ] **Step 1: Thêm include `nguoiDeXuat` trong `GET` (dòng 23-36)**

```js
    const proposal = await prisma.deXuatChiPhi.findUnique({
      where: { id },
      include: {
        danhMuc: true,
        nhaCungCap: true,
        quyThanhToan: true,
        nguoiTao: {
          select: { id: true, hoTen: true, tenNgan: true, email: true, role: true },
        },
        nguoiDeXuat: {
          select: { id: true, hoTen: true, tenNgan: true, email: true, role: true },
        },
        nguoiDuyet: {
          select: { id: true, hoTen: true, tenNgan: true, email: true },
        },
      },
    });
```

- [ ] **Step 2: Đổi RBAC check xem chi tiết (dòng 42-45)**

Thay:
```js
    // RBAC check
    if (isRestrictedToOwnProposals(user.role) && proposal.nguoiTaoId !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền xem đề xuất này.' }, { status: 403 });
    }
```

Thành:
```js
    // RBAC check — được xem nếu là người tạo HOẶC người được tạo giúp (người đề xuất)
    if (
      isRestrictedToOwnProposals(user.role) &&
      proposal.nguoiTaoId !== user.id &&
      proposal.nguoiDeXuatId !== user.id
    ) {
      return NextResponse.json({ error: 'Bạn không có quyền xem đề xuất này.' }, { status: 403 });
    }
```

- [ ] **Step 3: Đổi người nhận thông báo khi duyệt đơn (action DUYET, dòng 294-301)**

Thay `existingProposal.nguoiTaoId` bằng `existingProposal.nguoiDeXuatId`:

```js
      try {
        await notifyProposalApproved(existingProposal.nguoiDeXuatId, {
          title: '✅ Phiếu đã được duyệt',
          body: `${existingProposal.maPhieu} — ${Number(existingProposal.soTien).toLocaleString('vi-VN')}đ đã được thanh toán.`,
          url: '/de-xuat?open=' + existingProposal.id,
          tag: 'duyet-' + existingProposal.id,
        }, user.id);
      } catch (_) { /* push thất bại không làm hỏng nghiệp vụ */ }
```

> Lưu ý: quyền SỬA (dòng 311) và quyền HỦY (dòng 190) **giữ nguyên** theo `nguoiTaoId` — không đổi. Chỉ người thật sự bấm tạo (hoặc OWNER/MANAGER) được sửa/hủy.

- [ ] **Step 4: Verify bằng build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/de-xuat/[id]/route.js"
git commit -m "feat(api): xem chi tiet + thong bao duyet theo nguoiDeXuatId"
```

---

### Task 7: Dashboard — widget cá nhân STAFF/LEADER

**Files:**
- Modify: `web-app/src/app/api/dashboard/route.js:30-65`

- [ ] **Step 1: Thêm include `nguoiDeXuat` (dòng 30-36)**

```js
    const proposalInclude = {
      danhMuc: { include: { nhomChiPhi: true } },
      nhaCungCap: true,
      quyThanhToan: true,
      nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true, role: true } },
      nguoiDeXuat: { select: { id: true, hoTen: true, tenNgan: true, email: true, role: true } },
      nguoiDuyet: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
    };
```

- [ ] **Step 2: Đổi where của query "200 phiếu của mình" (dòng 59-65)**

Thay:
```js
      // STAFF/LEADER: tối đa 200 phiếu của mình để tính thống kê cá nhân
      isRestricted ? prisma.deXuatChiPhi.findMany({
        where: { nguoiTaoId: user.id },
        include: proposalInclude,
        orderBy: { ngayTao: 'desc' },
        take: 200,
      }) : Promise.resolve(null),
```

Thành:
```js
      // STAFF/LEADER: tối đa 200 phiếu liên quan tới mình (đã tạo hoặc được tạo giúp)
      isRestricted ? prisma.deXuatChiPhi.findMany({
        where: { OR: [{ nguoiTaoId: user.id }, { nguoiDeXuatId: user.id }] },
        include: proposalInclude,
        orderBy: { ngayTao: 'desc' },
        take: 200,
      }) : Promise.resolve(null),
```

- [ ] **Step 3: Verify bằng build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dashboard/route.js
git commit -m "feat(dashboard): widget ca nhan tinh theo nguoiTaoId hoac nguoiDeXuatId"
```

---

### Task 8: Widget "Đề xuất theo người" — group theo người đề xuất

**Files:**
- Modify: `web-app/src/lib/dashboardQueries.js:592-629`

- [ ] **Step 1: Đổi select trong query `rows` (dòng 599-604)**

Thay:
```js
      select: {
        soTien: true,
        trangThai: true,
        thuChiId: true,
        nguoiTao: { select: { id: true, hoTen: true, tenNgan: true } },
      },
```

Thành:
```js
      select: {
        soTien: true,
        trangThai: true,
        thuChiId: true,
        nguoiDeXuat: { select: { id: true, hoTen: true, tenNgan: true } },
      },
```

- [ ] **Step 2: Đổi vòng lặp group (dòng 620-629)**

Thay:
```js
  const byNguoi = {};
  for (const r of rows) {
    const id = r.nguoiTao?.id || '__unknown__';
    const name = r.nguoiTao?.tenNgan || r.nguoiTao?.hoTen || 'Không xác định';
```

Thành:
```js
  const byNguoi = {};
  for (const r of rows) {
    const id = r.nguoiDeXuat?.id || '__unknown__';
    const name = r.nguoiDeXuat?.tenNgan || r.nguoiDeXuat?.hoTen || 'Không xác định';
```

(Phần còn lại của hàm không đổi.)

- [ ] **Step 3: Verify bằng build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dashboardQueries.js
git commit -m "feat(dashboard): widget de xuat theo nguoi group theo nguoiDeXuat"
```

---

### Task 9: Duyệt gộp hoàn ứng (`duyet-gop`) — theo người đề xuất

**Files:**
- Modify: `web-app/src/app/api/de-xuat/duyet-gop/route.js:41-149`

- [ ] **Step 1: Thêm `nguoiDeXuat` vào include khi fetch proposals (dòng 42-49)**

```js
    const proposals = await prisma.deXuatChiPhi.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        danhMuc: true,
        nguoiDeXuat: true,
      },
    });
```

- [ ] **Step 2: Đổi validation "cùng 1 nhân viên" (dòng 58-82)**

Thay:
```js
    // 1. Phải ở trạng thái CHO_HOAN_UNG
    // 2. Phải cùng nguồn tiền TIEN_CA_NHAN
    // 3. Phải thuộc CÙNG một nhân viên đề xuất
    const staffId = proposals[0].nguoiTaoId;
    for (const prop of proposals) {
      if (prop.trangThai !== 'CHO_HOAN_UNG') {
        return NextResponse.json(
          { error: `Đề xuất ${prop.maPhieu} không ở trạng thái chờ hoàn ứng.` },
          { status: 400 }
        );
      }
      if (prop.nguonTien !== 'TIEN_CA_NHAN') {
        return NextResponse.json(
          { error: `Đề xuất ${prop.maPhieu} không phải là nguồn tiền cá nhân ứng.` },
          { status: 400 }
        );
      }
      if (prop.nguoiTaoId !== staffId) {
        return NextResponse.json(
          { error: 'Không thể duyệt gộp các đề xuất của nhiều nhân viên khác nhau.' },
          { status: 400 }
        );
      }
    }
```

Thành:
```js
    // 1. Phải ở trạng thái CHO_HOAN_UNG
    // 2. Phải cùng nguồn tiền TIEN_CA_NHAN
    // 3. Phải thuộc CÙNG một người đề xuất (nguoiDeXuatId)
    const staffId = proposals[0].nguoiDeXuatId;
    for (const prop of proposals) {
      if (prop.trangThai !== 'CHO_HOAN_UNG') {
        return NextResponse.json(
          { error: `Đề xuất ${prop.maPhieu} không ở trạng thái chờ hoàn ứng.` },
          { status: 400 }
        );
      }
      if (prop.nguonTien !== 'TIEN_CA_NHAN') {
        return NextResponse.json(
          { error: `Đề xuất ${prop.maPhieu} không phải là nguồn tiền cá nhân ứng.` },
          { status: 400 }
        );
      }
      if (prop.nguoiDeXuatId !== staffId) {
        return NextResponse.json(
          { error: 'Không thể duyệt gộp các đề xuất của nhiều người đề xuất khác nhau.' },
          { status: 400 }
        );
      }
    }
```

- [ ] **Step 3: Dùng `nguoiDeXuat` đã include thay vì fetch lại (dòng 87-90)**

Thay:
```js
    // Lấy thông tin nhân viên đề xuất để ghi nội dung
    const staffUser = await prisma.nhanVien.findUnique({
      where: { id: staffId },
    });
```

Thành:
```js
    // Thông tin người đề xuất để ghi nội dung (đã include ở bước fetch proposals)
    const staffUser = proposals[0].nguoiDeXuat;
```

- [ ] **Step 4: Đổi người nhận notify (dòng 141-148)**

Thay:
```js
    try {
      await notifyProposalApproved(staffId, {
```

Thành (không đổi gì khác trong block này — `staffId` giờ đã là `nguoiDeXuatId`):
```js
    try {
      await notifyProposalApproved(staffId, {
```

> Không cần sửa gì thêm ở bước này — vì `staffId` đã được gán lại thành `nguoiDeXuatId` ở Step 2, toàn bộ phần còn lại của file (nội dung phiếu Chi dòng 109, log dòng 138, notify dòng 142) tự động dùng đúng người đề xuất mà không cần đổi tên biến.

- [ ] **Step 5: Verify bằng build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/de-xuat/duyet-gop/route.js
git commit -m "feat(api): duyet-gop hoan ung theo nguoiDeXuatId"
```

---

### Task 10: Duyệt nhiều (`duyet-nhieu`) — notify theo người đề xuất

**Files:**
- Modify: `web-app/src/app/api/de-xuat/duyet-nhieu/route.js:133-160`

- [ ] **Step 1: Đổi key gom nhóm notify (dòng 133-137)**

Thay:
```js
        // Gom notification theo người tạo, không gửi riêng từng phiếu
        const nid = existingProposal.nguoiTaoId;
        if (!notifyMap[nid]) notifyMap[nid] = { firstId: id, maPhieus: [], tongTien: 0 };
        notifyMap[nid].maPhieus.push(existingProposal.maPhieu);
        notifyMap[nid].tongTien += Number(existingProposal.soTien);
```

Thành:
```js
        // Gom notification theo người đề xuất, không gửi riêng từng phiếu
        const nid = existingProposal.nguoiDeXuatId;
        if (!notifyMap[nid]) notifyMap[nid] = { firstId: id, maPhieus: [], tongTien: 0 };
        notifyMap[nid].maPhieus.push(existingProposal.maPhieu);
        notifyMap[nid].tongTien += Number(existingProposal.soTien);
```

- [ ] **Step 2: Đổi tên biến vòng lặp gửi (dòng 147-160) cho rõ nghĩa**

Thay:
```js
    // Gửi 1 notification tổng hợp cho mỗi người (thay vì N cái riêng lẻ)
    for (const [nguoiTaoId, info] of Object.entries(notifyMap)) {
      try {
        const count = info.maPhieus.length;
        const body = count === 1
          ? `${info.maPhieus[0]} — ${info.tongTien.toLocaleString('vi-VN')}đ đã được thanh toán.`
          : `${count} phiếu (${info.maPhieus.slice(0, 3).join(', ')}${count > 3 ? '...' : ''}) — tổng ${info.tongTien.toLocaleString('vi-VN')}đ đã được thanh toán.`;
        await notifyProposalApproved(nguoiTaoId, {
          title: '✅ Phiếu đã được duyệt',
          body,
          url: '/de-xuat?open=' + info.firstId,
          tag: 'duyet-nhieu-' + nguoiTaoId,
        }, user.id);
      } catch (_) { /* push thất bại không làm hỏng nghiệp vụ */ }
    }
```

Thành:
```js
    // Gửi 1 notification tổng hợp cho mỗi người đề xuất (thay vì N cái riêng lẻ)
    for (const [nguoiDeXuatId, info] of Object.entries(notifyMap)) {
      try {
        const count = info.maPhieus.length;
        const body = count === 1
          ? `${info.maPhieus[0]} — ${info.tongTien.toLocaleString('vi-VN')}đ đã được thanh toán.`
          : `${count} phiếu (${info.maPhieus.slice(0, 3).join(', ')}${count > 3 ? '...' : ''}) — tổng ${info.tongTien.toLocaleString('vi-VN')}đ đã được thanh toán.`;
        await notifyProposalApproved(nguoiDeXuatId, {
          title: '✅ Phiếu đã được duyệt',
          body,
          url: '/de-xuat?open=' + info.firstId,
          tag: 'duyet-nhieu-' + nguoiDeXuatId,
        }, user.id);
      } catch (_) { /* push thất bại không làm hỏng nghiệp vụ */ }
    }
```

- [ ] **Step 3: Verify bằng build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/de-xuat/duyet-nhieu/route.js
git commit -m "feat(api): duyet-nhieu thong bao theo nguoiDeXuatId"
```

---

### Task 11: UI form tạo đề xuất — "Tạo giúp cho người khác"

**Files:**
- Modify: `web-app/src/app/de-xuat/page.js`

- [ ] **Step 1: Thêm state mới (ngay sau dòng 109, sau `const [editingId, setEditingId] = useState(null);`)**

```js
  const [nguoiDeXuatId, setNguoiDeXuatId] = useState('');
  const [showTaoGiup, setShowTaoGiup] = useState(false);
  const [nguoiDeXuatOptions, setNguoiDeXuatOptions] = useState([]);
```

- [ ] **Step 2: Fetch danh sách hợp lệ khi mount — thêm vào cùng khối fetch tĩnh (ngay sau đoạn dòng 346-362 fetch `creatorsRes`/`quyRes`, bên trong cùng hàm, không phụ thuộc quyền `canUseProposalCreatorFilter` vì MỌI role đều được tạo giúp)**

```js
      // Danh sách NV được phép chọn làm "người đề xuất" khi tạo giúp — mọi role đều gọi được
      const taoGiupRes = await fetch('/api/nhan-su?scope=tao-giup');
      if (taoGiupRes.ok) {
        const taoGiupData = await taoGiupRes.json();
        setNguoiDeXuatOptions(taoGiupData || []);
      }
```

- [ ] **Step 3: Reset state trong `handleOpenAdd` (dòng 556-578, thêm 2 dòng trước `setIsModalOpen(true);`)**

```js
    setNguoiDeXuatId('');
    setShowTaoGiup(false);

    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };
```

- [ ] **Step 4: Thêm UI toggle + dropdown trong form modal — chèn ngay trước khối "Ai trả khoản này? *" (trước dòng 2180), CHỈ hiện khi `formType === 'ADD'`**

```js
                {formType === 'ADD' && (
                  <div className="form-group">
                    {!showTaoGiup ? (
                      <button
                        type="button"
                        className={styles.moreToggle}
                        onClick={() => setShowTaoGiup(true)}
                        disabled={formLoading || nguoiDeXuatOptions.length === 0}
                      >
                        <ChevronDown size={16} /> Tạo giúp cho người khác
                      </button>
                    ) : (
                      <>
                        <label className="form-label" htmlFor="nguoiDeXuatId" style={{ display: 'inline-flex', alignItems: 'center' }}>
                          Người đề xuất
                          <HelpTip text="Chọn nếu bạn đang tạo phiếu này giúp một nhân viên khác (họ tạm thời chưa dùng app). Phiếu vẫn hiển thị cho cả bạn và người được chọn." />
                        </label>
                        <select
                          id="nguoiDeXuatId"
                          className="form-control"
                          value={nguoiDeXuatId}
                          onChange={(e) => setNguoiDeXuatId(e.target.value)}
                          disabled={formLoading}
                        >
                          <option value="">-- Chính tôi --</option>
                          {nguoiDeXuatOptions.map((nv) => (
                            <option key={nv.id} value={nv.id}>
                              {nv.tenNgan || nv.hoTen} ({nv.role})
                            </option>
                          ))}
                        </select>
                        {nguoiDeXuatId && (
                          <small style={{ marginTop: '0.3rem', display: 'block', color: 'var(--info)', fontWeight: 600 }}>
                            Đang tạo giúp cho: {nguoiDeXuatOptions.find((nv) => nv.id === nguoiDeXuatId)?.tenNgan
                              || nguoiDeXuatOptions.find((nv) => nv.id === nguoiDeXuatId)?.hoTen}
                          </small>
                        )}
                        <button
                          type="button"
                          className={styles.moreToggle}
                          onClick={() => { setShowTaoGiup(false); setNguoiDeXuatId(''); }}
                          disabled={formLoading}
                          style={{ marginTop: '0.4rem' }}
                        >
                          Bỏ chọn, tự tạo cho mình
                        </button>
                      </>
                    )}
                  </div>
                )}

```

- [ ] **Step 5: Gửi `nguoiDeXuatId` khi submit (dòng 1405-1420, chỉ POST — không gửi khi PUT/EDIT)**

Thay:
```js
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngayPhatSinh,
          danhMucId,
          noiDung,
          soTien: Number(soTien),
          nhaCungCapId: nhaCungCapId || null,
          nguonTien,
          trangThai,
          ghiChu,
          ngayCanThanhToan: ngayCanThanhToan || null,
          anhHoaDon: anhHoaDon || null,
        }),
      });
```

Thành:
```js
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngayPhatSinh,
          danhMucId,
          noiDung,
          soTien: Number(soTien),
          nhaCungCapId: nhaCungCapId || null,
          nguonTien,
          trangThai,
          ghiChu,
          ngayCanThanhToan: ngayCanThanhToan || null,
          anhHoaDon: anhHoaDon || null,
          ...(formType === 'ADD' && nguoiDeXuatId ? { nguoiDeXuatId } : {}),
        }),
      });
```

- [ ] **Step 6: Verify bằng build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 7: Commit**

```bash
git add src/app/de-xuat/page.js
git commit -m "feat(ui): form tao de xuat co the tao giup cho nguoi khac"
```

---

### Task 12: UI danh sách/chi tiết đề xuất — hiển thị + đổi tên bộ lọc

**Files:**
- Modify: `web-app/src/app/de-xuat/page.js`

- [ ] **Step 1: Đổi tên state filter (dòng 89) và mọi chỗ dùng nó**

Thay `filterNguoiTao` → `filterNguoiDeXuat` ở TẤT CẢ các vị trí sau (tìm & thay chính xác, giữ nguyên phần còn lại của dòng):

| Dòng | Trước | Sau |
|---|---|---|
| 89 | `const [filterNguoiTao, setFilterNguoiTao] = useState([]);` | `const [filterNguoiDeXuat, setFilterNguoiDeXuat] = useState([]);` |
| 289 | `if (filterNguoiTao.length > 0) params.append('nguoiTaoId', filterNguoiTao.join(','));` | `if (filterNguoiDeXuat.length > 0) params.append('nguoiDeXuatId', filterNguoiDeXuat.join(','));` |
| 384 | `... filterNguoiTao, filterSearch ...` (trong dependency array `useEffect`) | `... filterNguoiDeXuat, filterSearch ...` |
| 1202 | `if (filterNguoiTao.length > 0) params.append('nguoiTaoId', filterNguoiTao.join(','));` | `if (filterNguoiDeXuat.length > 0) params.append('nguoiDeXuatId', filterNguoiDeXuat.join(','));` |
| 1669 | `selected={filterNguoiTao}` | `selected={filterNguoiDeXuat}` (và prop `onChange`/`onApply` tương ứng nếu đang gọi `setFilterNguoiTao`, đổi thành `setFilterNguoiDeXuat`) |

- [ ] **Step 2: Đổi hiển thị cột "Người đề xuất" trong bảng desktop (dòng 1773-1779)**

Thay:
```js
                        <td>
                          <span style={{ fontWeight: '600' }} title={prop.nguoiTao.hoTen}>
                            {prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}
                          </span>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiTao.role}</small>
                        </td>
```

Thành:
```js
                        <td>
                          <span style={{ fontWeight: '600' }} title={prop.nguoiDeXuat.hoTen}>
                            {prop.nguoiDeXuat.tenNgan || prop.nguoiDeXuat.hoTen}
                          </span>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiDeXuat.role}</small>
                          {prop.nguoiDeXuatId !== prop.nguoiTaoId && (
                            <>
                              <br />
                              <small style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                tạo bởi {prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}
                              </small>
                            </>
                          )}
                        </td>
```

- [ ] **Step 3: Đổi hiển thị mobile card (dòng 1922-1925)**

Thay:
```js
                        <div className={styles.cardDetailItem}>
                          <span className={styles.cardLabel}>Người đề xuất:</span>
                          <span className={styles.cardValue}>{prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}</span>
                        </div>
```

Thành:
```js
                        <div className={styles.cardDetailItem}>
                          <span className={styles.cardLabel}>Người đề xuất:</span>
                          <span className={styles.cardValue}>
                            {prop.nguoiDeXuat.tenNgan || prop.nguoiDeXuat.hoTen}
                            {prop.nguoiDeXuatId !== prop.nguoiTaoId && (
                              <small style={{ display: 'block', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                tạo bởi {prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}
                              </small>
                            )}
                          </span>
                        </div>
```

- [ ] **Step 4: Modal chi tiết — giữ "Người lập" = `nguoiTao` (đúng ý nghĩa sẵn có), thêm dòng "Người đề xuất" nếu khác (dòng 2956-2959)**

Thay:
```js
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Người lập:</span>
                  <span className={styles.detailValue}>{selectedProp.nguoiTao.tenNgan || selectedProp.nguoiTao.hoTen} ({selectedProp.nguoiTao.role})</span>
                </div>
```

Thành:
```js
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Người lập:</span>
                  <span className={styles.detailValue}>{selectedProp.nguoiTao.tenNgan || selectedProp.nguoiTao.hoTen} ({selectedProp.nguoiTao.role})</span>
                </div>
                {selectedProp.nguoiDeXuatId !== selectedProp.nguoiTaoId && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Người đề xuất:</span>
                    <span className={styles.detailValue}>{selectedProp.nguoiDeXuat.tenNgan || selectedProp.nguoiDeXuat.hoTen} ({selectedProp.nguoiDeXuat.role})</span>
                  </div>
                )}
```

- [ ] **Step 5: Verify bằng build**

Run: `npm run build`
Expected: build thành công, không còn tham chiếu `filterNguoiTao` nào sót lại (tìm `filterNguoiTao` trong file phải trả về 0 kết quả).

- [ ] **Step 6: Commit**

```bash
git add src/app/de-xuat/page.js
git commit -m "feat(ui): hien thi nguoi de xuat + doi ten bo loc sang nguoiDeXuatId"
```

---

### Task 13: UI trang Duyệt — grouping theo người đề xuất

**Files:**
- Modify: `web-app/src/app/de-xuat/duyet/page.js`

- [ ] **Step 1: Deep-link khi click thông báo (dòng 189)**

Thay:
```js
      setSelectedStaffId(target.nguoiTaoId);
```

Thành:
```js
      setSelectedStaffId(target.nguoiDeXuatId);
```

- [ ] **Step 2: Danh sách "Người đề xuất" distinct cho filter TH1/TH2 (dòng 479-494)**

Thay:
```js
  // Lọc "Người đề xuất" cho TH1/TH2: danh sách nhân viên distinct + danh sách phiếu đã lọc.
  const distinctStaffOf = (arr) => {
    const map = new Map();
    arr.forEach((p) => {
      if (p.nguoiTao && !map.has(p.nguoiTao.id)) map.set(p.nguoiTao.id, p.nguoiTao);
    });
    return Array.from(map.values());
  };
  const staffOptionsTH1 = distinctStaffOf(pendingPaymentProps);
  const staffOptionsTH2 = distinctStaffOf(pendingAssignFundProps);
  const filteredPaymentProps = filterNvDuyet
    ? pendingPaymentProps.filter((p) => p.nguoiTao?.id === filterNvDuyet)
    : pendingPaymentProps;
  const filteredAssignFundProps = filterNvDuyet
    ? pendingAssignFundProps.filter((p) => p.nguoiTao?.id === filterNvDuyet)
    : pendingAssignFundProps;

  // Khi đổi nhân viên lọc: bỏ chọn các phiếu không còn hiển thị để tránh duyệt nhầm.
  const handleChangeFilterNv = (value, baseProps) => {
    setFilterNvDuyet(value);
    if (value) {
      const visibleIds = baseProps
        .filter((p) => p.nguoiTao?.id === value)
        .map((p) => p.id);
      setSelectedPayIds((prev) => prev.filter((id) => visibleIds.includes(id)));
    }
  };
```

Thành:
```js
  // Lọc "Người đề xuất" cho TH1/TH2: danh sách người đề xuất distinct + danh sách phiếu đã lọc.
  const distinctStaffOf = (arr) => {
    const map = new Map();
    arr.forEach((p) => {
      if (p.nguoiDeXuat && !map.has(p.nguoiDeXuat.id)) map.set(p.nguoiDeXuat.id, p.nguoiDeXuat);
    });
    return Array.from(map.values());
  };
  const staffOptionsTH1 = distinctStaffOf(pendingPaymentProps);
  const staffOptionsTH2 = distinctStaffOf(pendingAssignFundProps);
  const filteredPaymentProps = filterNvDuyet
    ? pendingPaymentProps.filter((p) => p.nguoiDeXuat?.id === filterNvDuyet)
    : pendingPaymentProps;
  const filteredAssignFundProps = filterNvDuyet
    ? pendingAssignFundProps.filter((p) => p.nguoiDeXuat?.id === filterNvDuyet)
    : pendingAssignFundProps;

  // Khi đổi người lọc: bỏ chọn các phiếu không còn hiển thị để tránh duyệt nhầm.
  const handleChangeFilterNv = (value, baseProps) => {
    setFilterNvDuyet(value);
    if (value) {
      const visibleIds = baseProps
        .filter((p) => p.nguoiDeXuat?.id === value)
        .map((p) => p.id);
      setSelectedPayIds((prev) => prev.filter((id) => visibleIds.includes(id)));
    }
  };
```

- [ ] **Step 3: Nhóm hoàn ứng TH3 theo người đề xuất (dòng 507-518)**

Thay:
```js
  // Nhóm các đề xuất chờ hoàn ứng theo từng Nhân viên để duyệt gộp
  const staffGroups = {};
  pendingReimburseProps.forEach((p) => {
    const sId = p.nguoiTao.id;
    if (!staffGroups[sId]) {
      staffGroups[sId] = {
        nhanVien: p.nguoiTao,
        proposals: [],
      };
    }
    staffGroups[sId].proposals.push(p);
  });
```

Thành:
```js
  // Nhóm các đề xuất chờ hoàn ứng theo từng người đề xuất để duyệt gộp
  const staffGroups = {};
  pendingReimburseProps.forEach((p) => {
    const sId = p.nguoiDeXuat.id;
    if (!staffGroups[sId]) {
      staffGroups[sId] = {
        nhanVien: p.nguoiDeXuat,
        proposals: [],
      };
    }
    staffGroups[sId].proposals.push(p);
  });
```

- [ ] **Step 4: Hiển thị bảng TH1 (dòng 882-886) và TH2 (dòng 1150-1154) — thêm badge "tạo bởi" khi khác người**

Áp dụng CHO CẢ 2 vị trí (dòng 882-886 và dòng 1150-1154), thay:
```js
                        <td>
                          <span style={{ fontWeight: '600' }}>{prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}</span>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiTao.role}</small>
                        </td>
```

Thành:
```js
                        <td>
                          <span style={{ fontWeight: '600' }}>{prop.nguoiDeXuat.tenNgan || prop.nguoiDeXuat.hoTen}</span>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiDeXuat.role}</small>
                          {prop.nguoiDeXuatId !== prop.nguoiTaoId && (
                            <>
                              <br />
                              <small style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                tạo bởi {prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}
                              </small>
                            </>
                          )}
                        </td>
```

- [ ] **Step 5: Modal xem nhanh (dòng 1500) — đổi sang `nguoiDeXuat`**

Thay:
```js
                  <span className={styles.detailValue}>{selectedPreviewProp.nguoiTao.tenNgan || selectedPreviewProp.nguoiTao.hoTen} ({selectedPreviewProp.nguoiTao.role})</span>
```

Thành:
```js
                  <span className={styles.detailValue}>{selectedPreviewProp.nguoiDeXuat.tenNgan || selectedPreviewProp.nguoiDeXuat.hoTen} ({selectedPreviewProp.nguoiDeXuat.role})</span>
```

- [ ] **Step 6: Verify bằng build**

Run: `npm run build`
Expected: build thành công, không còn `prop.nguoiTao` nào sót ở các vị trí hiển thị "người đề xuất" trong 2 file `duyet/page.js` và `de-xuat/page.js` (đã đổi hết ở Task 12 + 13).

- [ ] **Step 7: Commit**

```bash
git add src/app/de-xuat/duyet/page.js
git commit -m "feat(ui): trang duyet group va hien thi theo nguoiDeXuat"
```

---

### Task 14: QA thủ công + cập nhật CONTEXT.md

**Files:**
- Modify: `web-app/CONTEXT.md` (mục 5 — đã làm)

- [ ] **Step 1: Build production để verify toàn bộ**

```bash
npm run build
```
Expected: build PASS, 0 lỗi.

- [ ] **Step 2: Chạy toàn bộ test**

```bash
npm run test
```
Expected: tất cả PASS, bao gồm test mới ở Task 2.

- [ ] **Step 3: QA thủ công trên dev server (checklist)**

Chạy `npm run dev`, đăng nhập lần lượt các tài khoản test, kiểm tra:

- [ ] STAFF (`test_staff`): mở form tạo đề xuất → thấy nút "Tạo giúp cho người khác" → bấm → dropdown chỉ hiện NV **ACTIVE, cùng phòng ban, cấp bậc <= STAFF** (không thấy MANAGER/OWNER khác phòng ban).
- [ ] STAFF tạo giúp cho 1 STAFF/LEADER khác cùng phòng ban → submit thành công → phiếu hiện trong danh sách của CẢ người tạo (STAFF) và người được chọn (đăng nhập tài khoản đó, kiểm tra thấy phiếu trong danh sách của họ).
- [ ] Người được chọn (nguoiDeXuat) mở được chi tiết phiếu (không bị 403), nhưng KHÔNG thấy nút Sửa/Hủy (vì không phải người tạo thật).
- [ ] Người tạo thật (nguoiTao) vẫn Sửa/Hủy được phiếu như bình thường.
- [ ] Bảng danh sách hiển thị đúng: cột "Người đề xuất" = người được chọn, có dòng nhỏ "tạo bởi ..." khi khác người tạo.
- [ ] OWNER/MANAGER vào trang Duyệt (`/de-xuat/duyet`): TH1/TH2 filter theo đúng người đề xuất; TH3 (hoàn ứng) gộp đúng theo người đề xuất, không lẫn giữa các người tạo giúp khác nhau cho cùng 1 người.
- [ ] Duyệt xong → notification/push gửi đúng cho người đề xuất (không phải người tạo hộ).
- [ ] Widget "Đề xuất theo người" ở Tổng quan (OWNER/MANAGER) group đúng theo người đề xuất.
- [ ] OWNER tạo giúp cho NV ở phòng ban khác → vẫn chọn được (không giới hạn phòng ban cho OWNER).

- [ ] **Step 4: Cập nhật CONTEXT.md**

Đọc `web-app/CONTEXT.md` mục 5 (đã làm), thêm 1 mục mới ở đầu danh sách (định dạng theo các mục sẵn có trong file), mô tả ngắn gọn: thêm field `nguoiDeXuatId` tách khỏi `nguoiTaoId`, cho phép tạo giúp phiếu đề xuất chi phí cho NV cùng phòng ban/cấp dưới, các điểm chạm đã cập nhật (quyền xem, hoàn ứng gộp, thông báo, widget thống kê).

- [ ] **Step 5: Commit cuối**

```bash
git add CONTEXT.md
git commit -m "docs: cap nhat CONTEXT.md - tinh nang nguoi de xuat"
```

---

## Ghi chú phạm vi (KHÔNG làm trong plan này)

- **Không đổi export Excel** (`handleSubmitImport`, `handleSubmitImportDx`, cột "Nhà cung cấp (nếu có)" dòng 636/815) — export vẫn dùng dữ liệu hiện có, có thể bổ sung cột "Người đề xuất" ở lần sau nếu cần.
- **Không cho sửa `nguoiDeXuatId` sau khi tạo** — chỉ chọn được lúc tạo mới (form ADD). Nếu chọn nhầm, phải hủy phiếu và tạo lại.
- **Không thay đổi FK `nguoiTaoId`** ở bất kỳ đâu — giữ nguyên ý nghĩa audit, không rủi ro tới `LichSuThaoTac`.
