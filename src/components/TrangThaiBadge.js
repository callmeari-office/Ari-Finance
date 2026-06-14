'use client';

const MAP = {
  CHO_THANH_TOAN: { label: 'Chờ thanh toán', cls: 'badge-pending' },
  CHO_HOAN_UNG:   { label: 'Chờ hoàn ứng',   cls: 'badge-reimburse' },
  DA_THANH_TOAN:  { label: 'Đã thanh toán',   cls: 'badge-paid' },
  HUY:            { label: 'Đã hủy',           cls: 'badge-cancelled' },
};

/**
 * TrangThaiBadge — ánh xạ trạng thái phiếu đề xuất sang badge màu chuẩn.
 * laLichSu=true: hiện "(Lịch sử)" bên cạnh nhãn DA_THANH_TOAN.
 */
export default function TrangThaiBadge({ trangThai, laLichSu = false }) {
  const meta = MAP[trangThai] || { label: trangThai || '—', cls: 'badge-pending' };
  const label = laLichSu && trangThai === 'DA_THANH_TOAN' ? 'Đã TT (Lịch sử)' : meta.label;
  return <span className={`badge ${meta.cls}`}>{label}</span>;
}
