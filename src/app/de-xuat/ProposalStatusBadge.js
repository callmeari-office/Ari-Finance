import {
  Archive,
  CheckCircle2,
  Clock3,
  HandCoins,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { getProposalStatusMeta } from './helpers';
import styles from './de-xuat.module.css';

const ICONS = {
  archive: Archive,
  check: CheckCircle2,
  clock: Clock3,
  'hand-coins': HandCoins,
  sparkles: Sparkles,
  x: XCircle,
};

const LABELS = {
  pending: 'Chờ thanh toán',
  reimburse: 'Chờ hoàn ứng',
  paid: 'Đã thanh toán',
  prepaid: 'Thanh toán sẵn',
  history: 'Đã thanh toán (Lịch sử)',
  historyCompact: 'Lịch sử',
  cancelled: 'Đã hủy',
};

const TONE_CLASS = {
  pending: styles.statusPending,
  reimburse: styles.statusReimburse,
  paid: styles.statusPaid,
  prepaid: styles.statusPrepaid,
  history: styles.statusHistory,
  cancelled: styles.statusCancelled,
};

export default function ProposalStatusBadge({ proposal, compact = false, title }) {
  const meta = getProposalStatusMeta(proposal, { compact });
  const Icon = ICONS[meta.icon] || Clock3;
  const label = meta.tone === 'history' && compact ? LABELS.historyCompact : (LABELS[meta.tone] || meta.label);
  const badgeTitle = title || label;

  return (
    <span className={`badge ${styles.proposalStatusBadge} ${TONE_CLASS[meta.tone] || styles.statusPending}`} title={badgeTitle}>
      <Icon size={13} className={styles.proposalStatusIcon} />
      <span>{label}</span>
    </span>
  );
}
