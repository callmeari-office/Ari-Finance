'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  SlidersHorizontal,
  ArrowRight,
  UserCheck,
  X,
  Activity,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import styles from './quy.module.css';

const KY_OPTIONS = [
  { key: 'thang', label: 'Tháng này' },
  { key: 'nam', label: 'Năm nay' },
  { key: 'all', label: 'Tất cả' },
];

const RECENT_LIMIT = 8;

export default function QuyReportPage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [funds, setFunds] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [expandedFund, setExpandedFund] = useState(null);

  // Lazy-load phiếu của từng quỹ: { [fundId]: { loading, items, error } }
  const [fundDetails, setFundDetails] = useState({});

  // KPI dòng tiền theo kỳ
  const [ky, setKy] = useState('thang');
  const [cashflow, setCashflow] = useState({ kyThu: 0, kyChi: 0, netCashflow: 0, tienDangUng: 0, soPhieuDangUng: 0 });

  // Dự báo dòng tiền 30 ngày
  const [forecast, setForecast] = useState(null);

  // Modal điều chỉnh số dư (OWNER)
  const [adjustFund, setAdjustFund] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.authenticated) {
          if (data.user.role !== 'OWNER' && data.user.role !== 'MANAGER' && !data.user.permissions?.quy) {
            toast.error('Bạn không có quyền truy cập trang Thông tin Quỹ.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          fetchFunds();
          fetch('/api/du-bao-dong-tien?days=30')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d) setForecast(d); })
            .catch(() => {});
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const fetchFunds = async () => {
    setDataLoading(true);
    try {
      const quyRes = await fetch('/api/quy');
      if (quyRes.ok) {
        const quyData = await quyRes.json();
        setFunds(Array.isArray(quyData) ? quyData : []);
      }
    } catch (e) {
      console.error('Error fetching fund data:', e);
    } finally {
      setDataLoading(false);
    }
  };

  // Tải KPI dòng tiền theo kỳ mỗi khi đổi kỳ
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/quy/cashflow?ky=${ky}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && !cancelled) setCashflow(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ky, user]);

  const toggleExpand = async (fundId) => {
    if (expandedFund === fundId) {
      setExpandedFund(null);
      return;
    }
    setExpandedFund(fundId);
    // Lazy-load lần đầu
    if (!fundDetails[fundId]) {
      setFundDetails((prev) => ({ ...prev, [fundId]: { loading: true, items: [], error: '' } }));
      try {
        const res = await fetch(`/api/thu-chi?quyId=${encodeURIComponent(fundId)}&limit=${RECENT_LIMIT}`);
        if (res.ok) {
          const d = await res.json();
          setFundDetails((prev) => ({ ...prev, [fundId]: { loading: false, items: d.data || [], error: '' } }));
        } else {
          setFundDetails((prev) => ({ ...prev, [fundId]: { loading: false, items: [], error: 'Không tải được phiếu.' } }));
        }
      } catch {
        setFundDetails((prev) => ({ ...prev, [fundId]: { loading: false, items: [], error: 'Không tải được phiếu.' } }));
      }
    }
  };

  const openAdjust = (fund, e) => {
    if (e) e.stopPropagation();
    setAdjustFund(fund);
    setAdjustTarget(String(Math.round(fund.soDuHienTai)));
    setAdjustReason('');
    setAdjustError('');
  };

  const submitAdjust = async () => {
    if (!adjustFund) return;
    const target = parseInt(String(adjustTarget).replace(/[^\d-]/g, ''), 10);
    if (isNaN(target)) {
      setAdjustError('Vui lòng nhập số dư thực tế hợp lệ.');
      return;
    }
    setAdjustSubmitting(true);
    setAdjustError('');
    try {
      const res = await fetch(`/api/quy/${encodeURIComponent(adjustFund.id)}/dieu-chinh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soDuMucTieu: target, lyDo: adjustReason.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setAdjustFund(null);
        await fetchFunds();
      } else {
        setAdjustError(d.error || 'Có lỗi xảy ra.');
      }
    } catch {
      setAdjustError('Không kết nối được máy chủ.');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải thông tin quỹ...</p>
      </div>
    );
  }

  const isOwner = user?.role === 'OWNER';
  const formatVND = (num) => Number(num || 0).toLocaleString('vi-VN') + ' ₫';

  const tongSoDuQuy = funds.reduce((sum, f) => sum + f.soDuHienTai, 0);
  const tongDuongDuong = funds.reduce((s, f) => s + Math.max(0, f.soDuHienTai), 0); // mẫu số cho tỷ trọng
  const coQuyAm = funds.some((f) => f.soDuHienTai < 0);
  const kyLabel = (KY_OPTIONS.find((o) => o.key === ky) || {}).label || '';

  const loaiQuyLabel = (lq) =>
    lq === 'TIEN_MAT' ? '💵 Tiền mặt' : lq === 'NGAN_HANG' ? '🏦 Ngân hàng' : '👤 Cá nhân ứng';

  // Preview chênh lệch trong modal điều chỉnh
  const adjustDelta = (() => {
    if (!adjustFund) return 0;
    const t = parseInt(String(adjustTarget).replace(/[^\d-]/g, ''), 10);
    if (isNaN(t)) return 0;
    return t - adjustFund.soDuHienTai;
  })();

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Thông tin Quỹ</h1>
            <p className={styles.pageDesc}>Theo dõi số dư realtime và dòng tiền vào ra trên các quỹ</p>
          </div>
        </div>

        {/* Cảnh báo quỹ âm */}
        {coQuyAm && (
          <div className={styles.warningBanner}>
            <AlertTriangle size={18} />
            <span>Có quỹ đang bị <strong>âm số dư</strong>. Kiểm tra lại các phiếu chi hoặc điều chỉnh cân bằng.</span>
          </div>
        )}

        {/* Bộ chọn kỳ cho dòng tiền VÀO/RA */}
        <div className={styles.kyBar}>
          <span className={styles.kyLabel}>Dòng tiền theo kỳ:</span>
          <div className={styles.kyToggle}>
            {KY_OPTIONS.map((o) => (
              <button
                key={o.key}
                className={`${styles.kyBtn} ${ky === o.key ? styles.kyBtnActive : ''}`}
                onClick={() => setKy(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className={styles.summaryGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className={`${styles.sumCard} glass-card`} style={{ borderLeft: '4px solid var(--brand-brown)' }}>
            <div className={styles.sumHeader}>
              <span style={{ color: 'var(--brand-brown)', fontWeight: '700' }}>Tổng số dư các Quỹ</span>
              <Wallet className={styles.sumIcon} style={{ color: 'var(--brand-brown)' }} />
            </div>
            <h3 style={{ fontSize: '1.6rem', color: tongSoDuQuy >= 0 ? 'var(--text-main)' : '#f87171' }}>{formatVND(tongSoDuQuy)}</h3>
            <p>Tiền mặt &amp; ngân hàng thực tế khả dụng (số dư hiện tại)</p>
          </div>

          <div className={`${styles.sumCard} ${styles.greenBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Dòng tiền VÀO (THU)</span>
              <TrendingUp className={styles.sumIcon} />
            </div>
            <h3>+{formatVND(cashflow.kyThu)}</h3>
            <p>Tiền thu nạp vào quỹ — {kyLabel.toLowerCase()}</p>
          </div>

          <div className={`${styles.sumCard} ${styles.redBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Dòng tiền RA (CHI)</span>
              <TrendingDown className={styles.sumIcon} />
            </div>
            <h3>-{formatVND(cashflow.kyChi)}</h3>
            <p>Chi thanh toán &amp; hoàn ứng — {kyLabel.toLowerCase()}</p>
          </div>

          <div className={`${styles.sumCard} ${styles.blueBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Dòng tiền thuần (Net)</span>
              <DollarSign className={styles.sumIcon} />
            </div>
            <h3 style={{ color: cashflow.netCashflow >= 0 ? '#34d399' : '#f87171' }}>
              {cashflow.netCashflow >= 0 ? '+' : ''}{formatVND(cashflow.netCashflow)}
            </h3>
            <p>Hiệu thu − chi {kyLabel.toLowerCase()}</p>
          </div>
        </div>

        {/* Thông tin tiền NV đang ứng */}
        {cashflow.tienDangUng > 0 && (
          <div className={styles.ungBanner}>
            <UserCheck size={18} />
            <span>
              Nhân viên đang ứng cá nhân chưa được hoàn: <strong>{formatVND(cashflow.tienDangUng)}</strong>
              {cashflow.soPhieuDangUng ? ` (${cashflow.soPhieuDangUng} phiếu)` : ''}.{' '}
              <a href="/de-xuat/duyet" className={styles.ungLink}>Xử lý hoàn ứng →</a>
            </span>
          </div>
        )}

        {/* Mini card: Dự báo 30 ngày */}
        {forecast && (
          <div className="glass-card" style={{ marginBottom: '1.5rem', borderLeft: `4px solid ${forecast.canhBaoAm ? '#ef4444' : 'var(--info)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Activity size={16} style={{ color: forecast.canhBaoAm ? '#ef4444' : 'var(--info)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Dự báo 30 ngày tới</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: forecast.soDuDuBaoCuoiKy >= 0 ? '#10b981' : '#ef4444', marginBottom: '0.25rem' }}>
              ~{formatVND(Math.abs(forecast.soDuDuBaoCuoiKy))}{forecast.soDuDuBaoCuoiKy < 0 ? ' (âm)' : ''}
            </div>
            {forecast.canhBaoAm ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={13} />
                Quỹ có thể âm khoảng ngày{' '}
                {new Date(forecast.ngayCoTheAm + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}
                {' '}— cần kiểm tra chi tiêu
              </p>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Xu hướng chi {formatVND(forecast.giaDinh.avgChiNgay)}/ngày ·{' '}
                Thu {forecast.giaDinh.nguonThu === 'ke-hoach' ? 'theo chỉ tiêu' : 'theo xu hướng'}{' '}
                {formatVND(forecast.giaDinh.avgThuNgay)}/ngày
                {forecast.giaDinh.soPhieuSapToi > 0 && ` · ${forecast.giaDinh.soPhieuSapToi} phiếu cam kết`}
              </p>
            )}
          </div>
        )}

        {/* Bảng kê quỹ */}
        <div className="glass-card">
          <div className={styles.cardHeader}>
            <Wallet size={20} className={styles.cardTitleIcon} />
            <h2>Bảng kê số dư chi tiết các Quỹ tiền</h2>
          </div>

          {dataLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
            </div>
          ) : funds.length === 0 ? (
            <div className={styles.emptyState}>Chưa có quỹ nào. Vào Cấu hình để thêm quỹ.</div>
          ) : (
            <>
              {/* ===== Desktop: bảng ===== */}
              <div className={`table-responsive ${styles.desktopOnly}`}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Mã Quỹ</th>
                      <th>Tên Quỹ</th>
                      <th>Loại Quỹ</th>
                      <th>Đầu Kỳ</th>
                      <th>Tổng Thu (+)</th>
                      <th>Tổng Chi (-)</th>
                      <th>Số dư Hiện Tại</th>
                      <th>Tỷ trọng</th>
                      <th>Phiếu</th>
                      {isOwner && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map((fund) => {
                      const isExpanded = expandedFund === fund.id;
                      const am = fund.soDuHienTai < 0;
                      const pct = tongDuongDuong > 0 ? Math.max(0, fund.soDuHienTai) / tongDuongDuong * 100 : 0;
                      const detail = fundDetails[fund.id];
                      const colSpan = isOwner ? 10 : 9;
                      return (
                        <React.Fragment key={fund.id}>
                          <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(fund.id)}>
                            <td style={{ fontWeight: 'bold', color: 'var(--info)' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {fund.id}
                              </span>
                            </td>
                            <td style={{ fontWeight: '600' }}>
                              {fund.tenQuy}
                              {fund.soDuDieuChinh ? (
                                <span className={styles.adjTag} title={`Đã điều chỉnh ${fund.soDuDieuChinh >= 0 ? '+' : ''}${formatVND(fund.soDuDieuChinh)}`}>
                                  đã chỉnh
                                </span>
                              ) : null}
                            </td>
                            <td>{loaiQuyLabel(fund.loaiQuy)}</td>
                            <td>{formatVND(fund.soDuDauKy)}</td>
                            <td style={{ color: 'var(--success)', fontWeight: '500' }}>+{formatVND(fund.tongThu)}</td>
                            <td style={{ color: 'var(--danger)', fontWeight: '500' }}>-{formatVND(fund.tongChi)}</td>
                            <td style={{ fontWeight: '800', color: am ? '#f87171' : '#34d399', fontSize: '1rem' }}>
                              {am && <AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: 3 }} />}
                              {formatVND(fund.soDuHienTai)}
                            </td>
                            <td style={{ minWidth: 90 }}>
                              <div className={styles.compRow}>
                                <div className={styles.compBarWrap}>
                                  <div className={styles.compBar} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={styles.compPct}>{Math.round(pct)}%</span>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-paid">{fund.soPhieu} phiếu</span>
                            </td>
                            {isOwner && (
                              <td>
                                <button className={styles.adjBtn} onClick={(e) => openAdjust(fund, e)} title="Điều chỉnh số dư">
                                  <SlidersHorizontal size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={colSpan} style={{ padding: 0 }}>
                                {renderDetail(fund, detail)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== Mobile: thẻ ===== */}
              <div className={styles.mobileCards}>
                {funds.map((fund) => {
                  const isExpanded = expandedFund === fund.id;
                  const am = fund.soDuHienTai < 0;
                  const pct = tongDuongDuong > 0 ? Math.max(0, fund.soDuHienTai) / tongDuongDuong * 100 : 0;
                  const detail = fundDetails[fund.id];
                  return (
                    <div key={fund.id} className={`${styles.fundCard} ${am ? styles.fundCardNeg : ''}`}>
                      <div className={styles.fcTop} onClick={() => toggleExpand(fund.id)}>
                        <div>
                          <div className={styles.fcName}>
                            {fund.tenQuy}
                            {fund.soDuDieuChinh ? <span className={styles.adjTag}>đã chỉnh</span> : null}
                          </div>
                          <div className={styles.fcMeta}>{fund.id} · {loaiQuyLabel(fund.loaiQuy)} · {fund.soPhieu} phiếu</div>
                        </div>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div className={styles.fcBalanceRow}>
                        <span className={styles.fcBalanceLabel}>Số dư hiện tại</span>
                        <span className={styles.fcBalance} style={{ color: am ? '#f87171' : '#34d399' }}>
                          {am && <AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: 3 }} />}
                          {formatVND(fund.soDuHienTai)}
                        </span>
                      </div>
                      <div className={styles.fcFlow}>
                        <span style={{ color: 'var(--success)' }}>+{formatVND(fund.tongThu)}</span>
                        <span style={{ color: 'var(--danger)' }}>-{formatVND(fund.tongChi)}</span>
                      </div>
                      <div className={styles.compBarWrap}>
                        <div className={styles.compBar} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={styles.fcActions}>
                        <span className={styles.compPct}>{Math.round(pct)}% tổng quỹ</span>
                        {isOwner && (
                          <button className={styles.adjBtnText} onClick={(e) => openAdjust(fund, e)}>
                            <SlidersHorizontal size={13} /> Điều chỉnh
                          </button>
                        )}
                      </div>
                      {isExpanded && renderDetail(fund, detail)}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modal điều chỉnh số dư */}
      {adjustFund && (
        <div className={styles.modalOverlay} onClick={() => !adjustSubmitting && setAdjustFund(null)}>
          <div className={`${styles.modal} glass-card`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3><SlidersHorizontal size={18} /> Điều chỉnh số dư quỹ</h3>
              <button className={styles.modalClose} onClick={() => !adjustSubmitting && setAdjustFund(null)}><X size={18} /></button>
            </div>
            <p className={styles.modalSub}>
              Quỹ <strong>{adjustFund.tenQuy}</strong> ({adjustFund.id}). Nhập số dư <strong>thực tế</strong> bạn kiểm đếm được — hệ thống sẽ cân bằng mà <strong>không tạo phiếu thu-chi</strong>.
            </p>

            <div className={styles.modalRow}>
              <span>Số dư đang ghi nhận</span>
              <strong>{formatVND(adjustFund.soDuHienTai)}</strong>
            </div>

            <label className={styles.modalLabel}>Số dư thực tế (₫) *</label>
            <input
              className={styles.modalInput}
              inputMode="numeric"
              value={adjustTarget ? Number(String(adjustTarget).replace(/[^\d-]/g, '') || 0).toLocaleString('vi-VN') : ''}
              onChange={(e) => setAdjustTarget(e.target.value.replace(/[^\d-]/g, ''))}
              placeholder="0"
            />

            <div className={styles.modalRow} style={{ marginTop: '0.5rem' }}>
              <span>Chênh lệch sẽ điều chỉnh</span>
              <strong style={{ color: adjustDelta === 0 ? 'var(--text-muted)' : adjustDelta > 0 ? '#34d399' : '#f87171' }}>
                {adjustDelta > 0 ? '+' : ''}{formatVND(adjustDelta)}
              </strong>
            </div>

            <label className={styles.modalLabel}>Lý do (khuyến nghị)</label>
            <textarea
              className={styles.modalTextarea}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="VD: Kiểm kê tiền mặt cuối ngày, làm tròn phí ngân hàng..."
              rows={2}
            />

            {adjustError && <div className={styles.modalError}>{adjustError}</div>}

            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setAdjustFund(null)} disabled={adjustSubmitting}>Hủy</button>
              <button className={styles.btnPrimary} onClick={submitAdjust} disabled={adjustSubmitting || adjustDelta === 0}>
                {adjustSubmitting ? 'Đang lưu...' : 'Xác nhận điều chỉnh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ===== Helper render chi tiết phiếu (dùng chung desktop + mobile) =====
  function renderDetail(fund, detail) {
    return (
      <div className={styles.detailBox}>
        <div className={styles.detailTitle}>
          PHIẾU GẦN NHẤT — QUỸ: {fund.tenQuy}
        </div>
        {!detail || detail.loading ? (
          <p className={styles.detailMuted}>Đang tải phiếu...</p>
        ) : detail.error ? (
          <p className={styles.detailMuted}>{detail.error}</p>
        ) : detail.items.length === 0 ? (
          <p className={styles.detailMuted}>Chưa có phiếu thu-chi nào từ quỹ này.</p>
        ) : (
          <>
            <div className={styles.detailList}>
              {detail.items.map((tx) => {
                const thu = tx.loaiGiaoDich === 'THU';
                return (
                  <div key={tx.id} className={styles.detailItem}>
                    <div className={styles.diLeft}>
                      <span className={styles.diCode}>{tx.maPhieu}</span>
                      <span className={styles.diDesc}>{tx.noiDung}</span>
                    </div>
                    <div className={styles.diRight}>
                      <span className={styles.diAmt} style={{ color: thu ? '#34d399' : '#f87171' }}>
                        {thu ? '+' : '-'}{formatVND(tx.soTien)}
                      </span>
                      <span className={styles.diDate} suppressHydrationWarning>
                        {new Date(tx.ngayGiaoDich).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {fund.soPhieu > detail.items.length && (
              <a href={`/thu-chi?quyId=${encodeURIComponent(fund.id)}`} className={styles.viewAll}>
                Xem tất cả {fund.soPhieu} phiếu <ArrowRight size={14} />
              </a>
            )}
          </>
        )}
      </div>
    );
  }
}
