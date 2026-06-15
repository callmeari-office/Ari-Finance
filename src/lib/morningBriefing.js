// src/lib/morningBriefing.js
// Thu thập số liệu + dựng HTML cho email "Báo cáo sáng".
// thuThapDuLieuBaoCao: cần prisma (dùng đúng nguồn dữ liệu chuẩn §4 CLAUDE.md).
// buildMorningBriefingHTML + formatTrieu: THUẦN (không đụng DB) → test được.

import { getFunds, getDuBao, getLoiNhuanNam, getCanhBao } from './dashboardQueries';
import { phanTramDat } from './finance';

const ONE_DAY = 24 * 60 * 60 * 1000;

/** Rút gọn tiền: 124000000 → "124tr", 89500000 → "89,5tr", <1tr → "500.000đ". */
export function formatTrieu(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0đ';
  if (Math.abs(v) >= 1_000_000) {
    const tr = v / 1_000_000;
    const s = (Math.round(tr * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return `${s}tr`;
  }
  return `${Math.round(v).toLocaleString('vi-VN')}đ`;
}

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Gom toàn bộ số liệu cho email. Trả về object thuần (xem spec §4).
 */
export async function thuThapDuLieuBaoCao(prisma) {
  const now = new Date();
  const nam = now.getFullYear();
  const thang = now.getMonth() + 1;

  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startYesterday = new Date(startToday.getTime() - ONE_DAY);

  const [funds, duBao, loiNhuan, canhBao, dtHomQua, choTT, choHU, quaHan, kenhActive, dtYesterdayRows] =
    await Promise.all([
      getFunds(prisma),
      getDuBao(prisma, 'thang'),
      getLoiNhuanNam(prisma, nam),
      getCanhBao(prisma, 3),
      prisma.doanhThuHangNgay.aggregate({ where: { ngay: startYesterday }, _sum: { soTien: true } }),
      prisma.deXuatChiPhi.aggregate({ where: { trangThai: 'CHO_THANH_TOAN', laLichSu: false }, _count: { _all: true }, _sum: { soTien: true } }),
      prisma.deXuatChiPhi.aggregate({ where: { trangThai: 'CHO_HOAN_UNG', laLichSu: false }, _count: { _all: true }, _sum: { soTien: true } }),
      prisma.deXuatChiPhi.aggregate({ where: { trangThai: { in: ['CHO_THANH_TOAN', 'CHO_HOAN_UNG'] }, laLichSu: false, ngayCanThanhToan: { lt: startToday } }, _count: { _all: true }, _sum: { soTien: true } }),
      prisma.kenhBan.count({ where: { trangThai: 'ACTIVE' } }),
      prisma.doanhThuHangNgay.findMany({ where: { ngay: startYesterday }, select: { kenhBanId: true } }),
    ]);

  const tongTien = (funds || []).reduce((s, q) => s + (q.soDuHienTai || 0), 0);
  const avgChiNgay = duBao?.giaDinh?.avgChiNgay || 0;
  const soNgayConTru = avgChiNgay > 0 ? Math.round(tongTien / avgChiNgay) : null;

  const m = loiNhuan?.months?.[thang - 1] || {};
  const doanhThuThang = m.doanhThuThucTe || 0;
  const mucTieuThang = m.doanhThuChiTieu || 0;
  const chiPhiThang = m.chiPhiThucTe || 0;
  const laiThang = m.loiNhuanThucTe || 0;

  const kenhDaNhap = new Set((dtYesterdayRows || []).map((r) => r.kenhBanId)).size;

  return {
    ngay: now,
    tien: {
      tongTien,
      quyList: (funds || []).map((q) => ({ tenQuy: q.tenQuy, soDuHienTai: q.soDuHienTai })),
      soNgayConTru,
      canhBaoAm: !!duBao?.canhBaoAm,
      ngayCoTheAm: duBao?.ngayCoTheAm || null,
    },
    hieuSuat: {
      doanhThuThang,
      mucTieuThang,
      pctDat: phanTramDat(doanhThuThang, mucTieuThang),
      chiPhiThang,
      laiThang,
      doanhThuHomQua: Number(dtHomQua?._sum?.soTien || 0),
    },
    canXuLy: {
      choThanhToan: { count: choTT._count._all, tong: choTT._sum.soTien || 0 },
      choHoanUng: { count: choHU._count._all, tong: choHU._sum.soTien || 0 },
      quaHan: { count: quaHan._count._all, tong: quaHan._sum.soTien || 0 },
      chuaNhapDoanhThu: { soKenh: Math.max(0, kenhActive - kenhDaNhap) },
    },
    canhBao: {
      nhacHan: canhBao?.nhacHan || [],
      vuotHanMuc: canhBao?.vuotHanMuc || [],
      vuotKeHoach: canhBao?.vuotKeHoach || [],
      tongSo: canhBao?.tongSo || 0,
    },
  };
}

// ── HTML (email-safe: table + inline style; tông nâu–kem–hồng phấn) ──────────

const C = {
  paper: '#FBF7F1', brown: '#6B5141', ink: '#5A4636', deepInk: '#4A3826',
  muted: '#9A8772', sand: '#F3ECE3', sandDeep: '#EFE6D8', blush: '#F6E7EC',
  pink: '#C4708C', cream: '#FBF7F1', creamMuted: '#CBB7A4',
  good: '#1D9E75', danger: '#A32D2D', amberBg: '#FBEEDA', amberInk: '#6B4E0B', amber: '#BA7517',
};

function sectionLabel(text) {
  return `<div style="margin:0 0 6px;font-size:12px;letter-spacing:1.5px;color:${C.muted};text-transform:uppercase;">${esc(text)}</div>`;
}

function metricCell(label, value, sub, subColor) {
  return `<td width="50%" valign="top" style="padding:5px;">
    <div style="background:${C.sand};border-radius:10px;padding:11px 13px;">
      <div style="font-size:11px;color:${C.muted};">${esc(label)}</div>
      <div style="font-size:17px;font-weight:600;color:${C.deepInk};">${esc(value)}</div>
      ${sub ? `<div style="font-size:11px;color:${subColor || C.ink};">${esc(sub)}</div>` : ''}
    </div>
  </td>`;
}

function canXuLyRow(label, count, tong, danger) {
  const color = danger ? C.danger : C.ink;
  return `<tr><td style="padding:11px 14px;border-bottom:1px solid #E5DACB;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:13px;color:${color};">${esc(label)}</td>
      <td align="right" style="font-size:13px;color:${color};"><b>${count}</b>${tong ? ` · ${formatTrieu(tong)}` : ''}</td>
    </tr></table>
  </td></tr>`;
}

/**
 * Dựng HTML email từ data + ai ({nhanDinh, deXuat[]} | null). Thuần, không đụng DB.
 */
export function buildMorningBriefingHTML(data, ai) {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const d = data?.ngay instanceof Date ? data.ngay : new Date();
  const ngayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const t = data.tien, h = data.hieuSuat, x = data.canXuLy, w = data.canhBao;

  const block = (inner) => `<tr><td style="padding:0 18px 18px;">${inner}</td></tr>`;

  // ① Nhận định AI
  const aiNhanDinh = ai?.nhanDinh
    ? `<tr><td style="padding:18px 18px 0;">
        <div style="background:${C.blush};border-left:3px solid ${C.pink};padding:14px 16px;">
          ${sectionLabel('Nhận định sáng nay')}
          <div style="font-size:14px;line-height:1.7;color:${C.ink};">${esc(ai.nhanDinh)}</div>
        </div></td></tr>`
    : '';

  // ② Tiền & Hiệu suất
  const quyLine = (t.quyList || []).length
    ? `<div style="font-size:11px;color:${C.muted};margin-top:6px;">${t.quyList.map((q) => `${esc(q.tenQuy)}: ${formatTrieu(q.soDuHienTai)}`).join(' · ')}</div>`
    : '';
  const duBaoLine = t.soNgayConTru != null
    ? `Dự báo đủ chi khoảng ${t.soNgayConTru} ngày tới${t.canhBaoAm ? ' ⚠️ có thể âm trong kỳ' : ''}`
    : 'Chưa đủ dữ liệu dự báo';
  const tienBlock = block(`
    ${sectionLabel('Tiền & Hiệu suất')}
    <div style="background:${C.sandDeep};border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="font-size:12px;color:${C.muted};">Tiền đang có</div>
      <div style="font-size:26px;font-weight:600;color:${C.deepInk};">${Number(t.tongTien || 0).toLocaleString('vi-VN')}đ</div>
      <div style="font-size:12px;color:#7E6A55;">${esc(duBaoLine)}</div>
      ${quyLine}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${metricCell('Doanh thu tháng', formatTrieu(h.doanhThuThang), `đạt ${h.pctDat}% mục tiêu`, C.good)}
      ${metricCell('Chi phí tháng', formatTrieu(h.chiPhiThang), null)}
    </tr><tr>
      ${metricCell('Lãi tạm tính', (h.laiThang >= 0 ? '+' : '') + formatTrieu(h.laiThang), null, h.laiThang >= 0 ? C.good : C.danger)}
      ${metricCell('Doanh thu hôm qua', formatTrieu(h.doanhThuHomQua), null)}
    </tr></table>
  `);

  // ③ Cần xử lý
  const rows = [];
  if (x.choThanhToan.count) rows.push(canXuLyRow('Phiếu chờ duyệt', x.choThanhToan.count, x.choThanhToan.tong, false));
  if (x.choHoanUng.count) rows.push(canXuLyRow('Chờ hoàn ứng', x.choHoanUng.count, x.choHoanUng.tong, false));
  if (x.quaHan.count) rows.push(canXuLyRow('Phiếu quá hạn', x.quaHan.count, x.quaHan.tong, true));
  if (x.chuaNhapDoanhThu.soKenh) rows.push(canXuLyRow('Kênh chưa nhập doanh thu hôm qua', x.chuaNhapDoanhThu.soKenh, 0, false));
  const canXuLyInner = rows.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.sand};border-radius:12px;">${rows.join('')}</table>`
    : `<div style="background:${C.sand};border-radius:12px;padding:14px 16px;font-size:13px;color:${C.ink};">Hôm nay không có việc gấp cần xử lý. 🎉</div>`;
  const canXuLyBlock = block(`${sectionLabel('Cần xử lý')}${canXuLyInner}`);

  // ④ Cảnh báo (chỉ khi có)
  const canhBaoItems = [];
  for (const v of (w.vuotHanMuc || []).slice(0, 3)) canhBaoItems.push(`<b>${esc(v.tenDanhMuc)}</b> đã dùng ${v.tile}% hạn mức tháng${v.vuot ? ' (đã vượt)' : ''}.`);
  for (const v of (w.vuotKeHoach || []).slice(0, 2)) canhBaoItems.push(`<b>${esc(v.tenDanhMuc)}</b> vượt kế hoạch (${v.tile}%).`);
  if (t.canhBaoAm) canhBaoItems.push('Dòng tiền dự báo có thể <b>âm</b> trong kỳ — cần để mắt.');
  if (x.quaHan.count) canhBaoItems.push(`Có <b>${x.quaHan.count} phiếu quá hạn</b> — để lâu ảnh hưởng uy tín với NCC.`);
  const canhBaoBlock = canhBaoItems.length
    ? block(`${sectionLabel('Cảnh báo rủi ro')}
        <div style="background:${C.amberBg};border-left:3px solid ${C.amber};padding:13px 15px;">
          ${canhBaoItems.map((it) => `<div style="font-size:13px;line-height:1.6;color:${C.amberInk};margin-bottom:7px;">• ${it}</div>`).join('')}
        </div>`)
    : '';

  // ⑤ Đề xuất từ Ari (AI)
  const deXuatBlock = (ai?.deXuat && ai.deXuat.length)
    ? block(`${sectionLabel('Đề xuất từ Ari')}
        <div style="background:${C.blush};border-radius:12px;padding:14px 16px;">
          ${ai.deXuat.map((s, i) => `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${i < ai.deXuat.length - 1 ? '11px' : '0'};"><tr>
            <td width="18" valign="top" style="color:${C.pink};font-weight:600;font-size:13px;">${i + 1}.</td>
            <td style="font-size:13px;line-height:1.6;color:${C.ink};">${esc(s)}</td></tr></table>`).join('')}
        </div>`)
    : '';

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EDE7DF;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EDE7DF;padding:20px 0;"><tr><td align="center">
  <table width="440" cellpadding="0" cellspacing="0" style="width:440px;max-width:96%;background:${C.paper};border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${C.ink};">
    <tr><td style="background:${C.brown};padding:22px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td width="52" valign="middle"><img src="${appUrl}/ari-cameo.png" width="44" height="44" alt="Call Me Ari" style="display:block;"></td>
        <td valign="middle" style="padding-left:10px;">
          <div style="color:${C.cream};font-size:17px;font-weight:600;">Call Me Ari</div>
          <div style="color:${C.creamMuted};font-size:11px;letter-spacing:1.5px;">QUẢN LÝ TÀI CHÍNH</div>
          <div style="color:${C.creamMuted};font-size:12px;margin-top:5px;">☀️ Báo cáo sáng · ${ngayStr}</div>
        </td>
      </tr></table>
    </td></tr>
    ${aiNhanDinh}
    ${tienBlock}
    ${canXuLyBlock}
    ${canhBaoBlock}
    ${deXuatBlock}
    <tr><td align="center" style="padding:4px 18px 24px;">
      <a href="${appUrl}" style="display:inline-block;background:${C.brown};color:${C.cream};text-decoration:none;font-size:14px;font-weight:600;padding:11px 26px;border-radius:10px;">Mở app xem chi tiết</a>
      <div style="margin-top:14px;font-size:11px;color:#B0A089;">Call Me Ari · Tự động gửi 8:00 sáng mỗi ngày</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
