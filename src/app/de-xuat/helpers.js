// src/app/de-xuat/helpers.js
// Pure helpers for the De Xuat page so page.js stays smaller and logic is testable.

export function formatSoTienDisplay(raw) {
  if (!raw) return '';
  const num = parseInt(raw, 10);
  return Number.isNaN(num) ? '' : num.toLocaleString('vi-VN');
}

export function parseDateCell(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(v).trim();
  const isoLike = s.match(/^(\d{2}|\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoLike) {
    let year = isoLike[1];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${isoLike[2].padStart(2, '0')}-${isoLike[3].padStart(2, '0')}`;
  }

  const localized = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (localized) {
    let year = localized[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${localized[2].padStart(2, '0')}-${localized[1].padStart(2, '0')}`;
  }

  return null;
}

export function getProposalApproveGroup(p) {
  if (!p) return null;
  if (p.trangThai === 'CHO_HOAN_UNG') return 'HOAN_UNG';
  if (p.trangThai === 'CHO_THANH_TOAN') return 'TIEN_SHOP';
  if (p.trangThai === 'DA_THANH_TOAN' && !p.laLichSu && p.thuChiId == null) return 'TIEN_SHOP';
  return null;
}

export function resolveBulkApproveGroup(selectedProps) {
  if (!selectedProps || selectedProps.length === 0) {
    return { group: null, reason: 'Chua chon phieu nao.' };
  }

  const groups = new Set(selectedProps.map(getProposalApproveGroup));
  if (groups.has(null)) {
    return {
      group: null,
      reason: 'Co phieu khong the duyet (da thanh toan/da huy). Hay loc theo trang thai truoc khi chon.',
    };
  }

  if (groups.size > 1) {
    return {
      group: null,
      reason: 'Dang tron phieu tien shop va hoan ung. Hay loc theo 1 nhom trang thai roi chon lai.',
    };
  }

  return { group: Array.from(groups)[0], reason: '' };
}

export function getProposalStatusMeta(prop, options = {}) {
  const compact = options.compact === true;

  if (!prop) {
    return { label: '-', tone: 'pending', icon: 'clock' };
  }

  if (prop.trangThai === 'DA_THANH_TOAN') {
    if (prop.laLichSu) {
      return {
        label: compact ? 'Lich su' : 'Da thanh toan (Lich su)',
        tone: 'history',
        icon: 'archive',
      };
    }

    if (prop.thuChiId == null) {
      return {
        label: 'Thanh toan san',
        tone: 'prepaid',
        icon: 'sparkles',
      };
    }

    return {
      label: 'Da thanh toan',
      tone: 'paid',
      icon: 'check',
    };
  }

  if (prop.trangThai === 'CHO_HOAN_UNG') {
    return {
      label: 'Cho hoan ung',
      tone: 'reimburse',
      icon: 'hand-coins',
    };
  }

  if (prop.trangThai === 'HUY') {
    return {
      label: 'Da huy',
      tone: 'cancelled',
      icon: 'x',
    };
  }

  if (prop.trangThai === 'CHO_THANH_TOAN') {
    return {
      label: 'Cho thanh toan',
      tone: 'pending',
      icon: 'clock',
    };
  }

  return {
    label: prop.trangThai || '-',
    tone: 'pending',
    icon: 'clock',
  };
}
