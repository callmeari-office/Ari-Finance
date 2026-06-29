# Plan: Cải thiện hệ thống thông báo — ARI Finance

> Tạo: 2026-06-29. Dùng prompt này để bắt đầu session triển khai.

---

## Tóm tắt 7 việc cần làm

| # | Việc | Độ phức tạp | File chính |
|---|---|---|---|
| 1 | Bell panel: thêm vượt hạn mức + vượt kế hoạch | Thấp | `Sidebar.js` |
| 2 | Read status ThongBaoNoiBo (localStorage) | Thấp | `Sidebar.js` |
| 3 | Anti-spam: fixed tag Web Push | Thấp | `api/de-xuat/route.js`, `api/de-xuat/bulk/route.js`, `api/de-xuat/import-de-xuat/route.js` |
| 4 | Import Excel → thêm Web Push | Thấp | `api/de-xuat/import-de-xuat/route.js` |
| 5 | CHO_HOAN_UNG tạo mới → push OWNER/MANAGER | Thấp | `api/de-xuat/route.js` |
| 6 | Fix người duyệt tự nhận push "đã duyệt" | Thấp | `webpush.js`, 3 route duyet |
| 7 | Bell poll refresh khi app vào foreground | Thấp | `Sidebar.js` |

Không cần DB migration (read status dùng localStorage).

---

## Chi tiết từng thay đổi

### 1. Bell panel: vượt hạn mức + vượt kế hoạch

**Vấn đề:** `getCanhBao` trả về `vuotHanMuc[]` và `vuotKeHoach[]` nhưng `Sidebar.js` bỏ qua — không hiện trong panel, không tính vào badge.

**Sửa `Sidebar.js`:**
```js
// state hiện tại
const [nhacHan, setNhacHan] = useState([]);
// thêm:
const [vuotHanMuc, setVuotHanMuc] = useState([]);
const [vuotKeHoach, setVuotKeHoach] = useState([]);

// trong fetchAll, phần xử lý resCb:
const cb = await resCb.json();
setPendingCount(cb.pendingCount || 0);
setNhacHan(Array.isArray(cb.nhacHan) ? cb.nhacHan.slice(0, 5) : []);
setVuotHanMuc(Array.isArray(cb.vuotHanMuc) ? cb.vuotHanMuc.slice(0, 3) : []); // thêm
setVuotKeHoach(Array.isArray(cb.vuotKeHoach) ? cb.vuotKeHoach.slice(0, 3) : []); // thêm

// bellBadge: cộng thêm vuotHanMuc + vuotKeHoach
const bellBadge = tbList.length
  + (isOwnerOrManager ? nhacHan.length + vuotHanMuc.length + vuotKeHoach.length : 0);

// bellRed: thêm điều kiện vuotHanMuc
const bellRed = hasQuanTrong || nhacHan.some(n => n.quaHan) || vuotHanMuc.length > 0;
```

**Render trong panel** (sau block nhacHan, trước block tbList):
- Mỗi item `vuotHanMuc`: icon `BarChart2` màu `var(--warning)`, badge "Vượt hạn mức", link → `/ke-hoach`
- Mỗi item `vuotKeHoach`: icon `TrendingUp` màu `var(--info)`, badge "Vượt kế hoạch", link → `/ke-hoach`
- Cần đọc shape thực của `vuotHanMuc[i]` và `vuotKeHoach[i]` từ `getCanhBao` trong `dashboardQueries.js` trước khi render.

---

### 2. Read status (localStorage — không cần DB migration)

**Vấn đề:** ThongBaoNoiBo không có trạng thái đọc → mọi lần mở panel đều thấy tất cả như mới.

**Cách làm (zero DB migration):** Lưu `Set<id>` vào localStorage key `ari-seen-tb-{userId}`.

```js
// helper trong Sidebar.js (hoặc tách lib nhỏ):
const SEEN_KEY = (uid) => `ari-seen-tb-${uid}`;
const getSeenIds = (uid) => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || '[]')); }
  catch { return new Set(); }
};
const markSeen = (uid, ids) => {
  try { localStorage.setItem(SEEN_KEY(uid), JSON.stringify([...ids])); } catch {}
};

// Khi panel mở (showNotifPanel = true → useEffect):
useEffect(() => {
  if (!showNotifPanel || !user) return;
  // Đánh dấu tất cả tbList hiện tại là đã đọc
  const seenIds = getSeenIds(user.id);
  tbList.forEach(tb => seenIds.add(tb.id));
  markSeen(user.id, seenIds);
  setSeenTbIds(new Set(seenIds)); // state để re-render
}, [showNotifPanel]);
```

**UI:** tbList item chưa trong seenIds → hiện dấu chấm xanh nhỏ bên trái tiêu đề.
Badge bell chỉ tính tbList items chưa đọc: `tbList.filter(tb => !seenTbIds.has(tb.id)).length`.

---

### 3. Anti-spam Web Push: fixed tag

**Vấn đề:** Tạo nhiều phiếu đơn lẻ liên tiếp → mỗi phiếu ra 1 push riêng → spam.

**Fix:** Dùng tag cố định `'new-proposals'` — trình duyệt sẽ **replace** notification cũ thay vì chồng thêm.

**`api/de-xuat/route.js` (single create):**
```js
// TRƯỚC:
pushNotifyManagers({
  title: 'Phiếu mới chờ duyệt',
  body: `${newProposal.noiDung} — ${soTien}đ`,
  url: '/de-xuat/duyet?open=' + newProposal.id,
  tag: 'phieu-' + newProposal.id, // ← unique, không dedup
}).catch(() => {});

// SAU:
pushNotifyManagers({
  title: 'Phiếu mới chờ duyệt',
  body: `${newProposal.noiDung} — ${soTien}đ`,
  url: '/de-xuat/duyet',
  tag: 'new-proposals', // ← fixed → replace notification cũ
}).catch(() => {});
```

**`api/de-xuat/bulk/route.js`** (tạo nhiều): Hiện không có push. Thêm sau khi tạo xong:
```js
import { notifyManagers as pushNotifyManagers } from '@/lib/webpush';
// ...
if (choTTIds.length > 0) {
  await notifyManagersBulkChoThanhToan(choTTIds);
  pushNotifyManagers({
    title: `${choTTIds.length} phiếu mới chờ duyệt`,
    body: `Vừa tạo ${choTTIds.length} đề xuất — bấm để xem.`,
    url: '/de-xuat/duyet',
    tag: 'new-proposals',
  }).catch(() => {});
}
```

---

### 4. Import Excel → thêm Web Push

**Vấn đề:** `import-de-xuat/route.js` gọi email bulk (đang TẮT) nhưng không có push → OWNER/MANAGER không biết có hàng loạt phiếu mới.

**`api/de-xuat/import-de-xuat/route.js`:**
```js
import { notifyManagers as pushNotifyManagers } from '@/lib/webpush'; // thêm import

// sau khi notifyManagersBulkChoThanhToan:
if (choTTRows.length > 0) {
  await notifyManagersBulkChoThanhToan(choTTRows.map(r => r.id));
  pushNotifyManagers({
    title: `${choTTRows.length} phiếu import chờ duyệt`,
    body: `Vừa nhập ${choTTRows.length} đề xuất từ Excel — bấm để duyệt.`,
    url: '/de-xuat/duyet',
    tag: 'new-proposals',
  }).catch(() => {});
}
```

---

### 5. CHO_HOAN_UNG tạo mới → push OWNER/MANAGER

**Vấn đề:** Phiếu "Mình ứng trước" (`CHO_HOAN_UNG`) tạo mới không trigger push.

**`api/de-xuat/route.js`:**
```js
// TRƯỚC:
if (newProposal.trangThai === 'CHO_THANH_TOAN') {
  await notifyManagersChoThanhToan(newProposal.id);
  pushNotifyManagers({ title: 'Phiếu mới chờ duyệt', ... }).catch(() => {});
}

// SAU:
if (newProposal.trangThai === 'CHO_THANH_TOAN') {
  await notifyManagersChoThanhToan(newProposal.id);
  pushNotifyManagers({
    title: 'Phiếu mới chờ duyệt',
    body: `${newProposal.noiDung} — ${soTien}đ`,
    url: '/de-xuat/duyet',
    tag: 'new-proposals',
  }).catch(() => {});
} else if (newProposal.trangThai === 'CHO_HOAN_UNG') {
  pushNotifyManagers({
    title: 'Phiếu hoàn ứng mới',
    body: `${newProposal.noiDung} — ${soTien}đ (tiền cá nhân)`,
    url: '/de-xuat/duyet',
    tag: 'new-proposals',
  }).catch(() => {});
}
```

---

### 6. Fix người duyệt tự nhận push "đã duyệt"

**Vấn đề:** `notifyProposalApproved` gọi `notifyManagers` không exclude `approverId` → Manager bấm Duyệt tự nhận lại push.

**`webpush.js` — sửa signature:**
```js
// TRƯỚC:
export async function notifyProposalApproved(creatorId, payload) {
  await notifyManagers(payload); // gửi TẤT CẢ

// SAU:
export async function notifyProposalApproved(creatorId, payload, approverId = null) {
  await notifyManagers(payload, approverId ? { excludeUserId: approverId } : {});
```

**3 route gọi hàm này — truyền thêm `user.id`:**
- `api/de-xuat/[id]/route.js`: `notifyProposalApproved(existingProposal.nguoiTaoId, payload, user.id)`
- `api/de-xuat/duyet-nhieu/route.js`: `notifyProposalApproved(nguoiTaoId, payload, user.id)`
- `api/de-xuat/duyet-gop/route.js`: `notifyProposalApproved(staffId, payload, user.id)`

---

### 7. Refresh bell khi app vào foreground

**Vấn đề:** Poll 30s không phản ứng khi user mở lại tab sau khi nhận Web Push.

**`Sidebar.js`:**
```js
// Thêm vào useEffect chứa fetchAll:
useEffect(() => {
  if (!user) return;
  // ... interval hiện tại giữ nguyên ...

  // Thêm: refresh khi tab active trở lại
  const handleVisibility = () => {
    if (!document.hidden) fetchAll();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, [user]);
```

---

## Thứ tự thực hiện khuyến nghị

1. Việc 6 (fix approverId) — không có UI, test ngay bằng build
2. Việc 3 + 4 + 5 (push tags + import + hoàn ứng) — cùng nhóm, sửa API routes
3. Việc 7 (visibilitychange) — 5 dòng code
4. Việc 1 (bell panel vuotHanMuc/vuotKeHoach) — đọc shape getCanhBao trước khi render
5. Việc 2 (read status localStorage) — thêm state + useEffect + UI dot

Verify sau mỗi nhóm: `npm run build` pass.

---

## Lưu ý kỹ thuật

- `notifyManagers` / `pushNotifyManagers` luôn bọc `.catch(() => {})` — không được để lỗi push hỏng luồng nghiệp vụ.
- Không sửa `DONUT_COLORS`, `stroke=`, `fill=` trong SVG — ngoại lệ theo `coding-style.md`.
- Sau khi sửa Sidebar.js, kiểm tra cả 3 theme (light/dark/pink) không bị vỡ màu.
- Không cần DB migration trong toàn bộ plan này.
