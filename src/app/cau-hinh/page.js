'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  Info,
  Wallet
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import styles from './cau-hinh.module.css';

export default function CauHinhPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Configuration data states
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [funds, setFunds] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Fund modal states
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [fundFormType, setFundFormType] = useState('ADD');
  const [fundFormLoading, setFundFormLoading] = useState(false);
  const [fundFormError, setFundFormError] = useState('');
  const [fundFormSuccess, setFundFormSuccess] = useState('');
  const [fundId, setFundId] = useState('');
  const [fundTen, setFundTen] = useState('');
  const [fundLoai, setFundLoai] = useState('TIEN_MAT');
  const [fundSoDu, setFundSoDu] = useState('');
  const [fundTrangThai, setFundTrangThai] = useState('ACTIVE');

  // Form Modal States (Danh Mục)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState('ADD'); // 'ADD' hoặc 'EDIT'
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form Inputs (Danh Mục)
  const [id, setId] = useState('');
  const [tenDanhMuc, setTenDanhMuc] = useState('');
  const [nhomChiPhiId, setNhomChiPhiId] = useState('');
  const [loaiGiaoDich, setLoaiGiaoDich] = useState('CHI');
  const [viewRoles, setViewRoles] = useState({
    OWNER: true,
    MANAGER: true,
    LEADER: true,
    STAFF: true
  });
  const [yeuCauNCC, setYeuCauNCC] = useState(false);
  const [hanMucThang, setHanMucThang] = useState('');
  const [trangThai, setTrangThai] = useState('ACTIVE');

  // Form Modal States (Nhóm)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupFormType, setGroupFormType] = useState('ADD'); // 'ADD' hoặc 'EDIT'
  const [groupFormLoading, setGroupFormLoading] = useState(false);
  const [groupFormError, setGroupFormError] = useState('');
  const [groupFormSuccess, setGroupFormSuccess] = useState('');

  // Form Inputs (Nhóm)
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupOrder, setGroupOrder] = useState('');

  useEffect(() => {
    // 1. Check Auth & Role
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
          if (data.user.role !== 'OWNER') {
            alert('Bạn không có quyền truy cập cấu hình hệ thống.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          // 2. Fetch config data
          fetchData();
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const [cfRes, quyRes] = await Promise.all([
        fetch('/api/cau-hinh'),
        fetch('/api/quy'),
      ]);
      if (cfRes.ok) {
        const data = await cfRes.json();
        setCategories(data.categories || []);
        setGroups(data.groups || []);
        if (data.groups && data.groups.length > 0) {
          setNhomChiPhiId(data.groups[0].id);
        }
      }
      if (quyRes.ok) {
        const quyData = await quyRes.json();
        setFunds(quyData);
      }
    } catch (e) {
      console.error('Error fetching configuration:', e);
    } finally {
      setDataLoading(false);
    }
  };
 
  // Tự động chuyển nhóm hợp lý khi đổi loại giao dịch trong Form để tránh lỗi UX
  useEffect(() => {
    if (isModalOpen && groups.length > 0) {
      const filtered = groups.filter(g => {
        if (loaiGiaoDich === 'CHI') {
          return g.id.toUpperCase().startsWith('C');
        } else {
          return g.id.toUpperCase().startsWith('T') || g.id.toUpperCase().startsWith('THU');
        }
      });
      if (filtered.length > 0) {
        // Nếu nhomChiPhiId hiện tại không thuộc danh sách nhóm tương thích mới, đổi về nhóm đầu tiên hợp lệ
        const matches = filtered.some(g => g.id === nhomChiPhiId);
        if (!matches) {
          setNhomChiPhiId(filtered[0].id);
        }
      }
    }
  }, [loaiGiaoDich, isModalOpen, groups]);


  // --- CÁC HÀM XỬ LÝ DANH MỤC ---
  const handleOpenAdd = () => {
    setFormType('ADD');
    setId('');
    setTenDanhMuc('');
    if (groups.length > 0) setNhomChiPhiId(groups[0].id);
    setLoaiGiaoDich('CHI');
    setViewRoles({ OWNER: true, MANAGER: true, LEADER: true, STAFF: true });
    setYeuCauNCC(false);
    setHanMucThang('');
    setTrangThai('ACTIVE');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setFormType('EDIT');
    setId(cat.id);
    setTenDanhMuc(cat.tenDanhMuc);
    setNhomChiPhiId(cat.nhomChiPhiId);
    setLoaiGiaoDich(cat.loaiGiaoDich);
    setYeuCauNCC(cat.yeuCauNCC);
    setHanMucThang(cat.hanMucThang ? cat.hanMucThang.toString() : '');
    setTrangThai(cat.trangThai);
    
    // Parse roles
    try {
      const roles = JSON.parse(cat.chucVuDuocXem);
      setViewRoles({
        OWNER: roles.includes('OWNER'),
        MANAGER: roles.includes('MANAGER'),
        LEADER: roles.includes('LEADER'),
        STAFF: roles.includes('STAFF')
      });
    } catch (e) {
      setViewRoles({ OWNER: true, MANAGER: true, LEADER: true, STAFF: true });
    }

    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Check at least one role is checked
    const selectedRoles = Object.keys(viewRoles).filter(role => viewRoles[role]);
    if (selectedRoles.length === 0) {
      setFormError('Vui lòng chọn ít nhất một vai trò được quyền xem.');
      return;
    }

    if (!id || !tenDanhMuc || !nhomChiPhiId) {
      setFormError('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }

    // Kiểm tra tính nhất quán giữa nhóm và loại giao dịch ở frontend
    const nhomId = nhomChiPhiId.toUpperCase();
    const isGroupThu = nhomId.startsWith('T');
    const isGroupChi = nhomId.startsWith('C');

    if (loaiGiaoDich === 'CHI' && !isGroupChi) {
      setFormError(`Nhóm được chọn [${nhomChiPhiId}] không hợp lệ cho Loại Giao Dịch CHI (Mã nhóm chi phí phải bắt đầu bằng chữ C).`);
      return;
    }

    if (loaiGiaoDich === 'THU' && !isGroupThu) {
      setFormError(`Nhóm được chọn [${nhomChiPhiId}] không hợp lệ cho Loại Giao Dịch THU (Mã nhóm nguồn thu phải bắt đầu bằng chữ T).`);
      return;
    }


    setFormLoading(true);

    const payload = {
      id: id.trim(),
      tenDanhMuc: tenDanhMuc.trim(),
      nhomChiPhiId,
      loaiGiaoDich,
      chucVuDuocXem: selectedRoles,
      yeuCauNCC,
      hanMucThang: hanMucThang ? Number(hanMucThang) : null,
      trangThai
    };

    try {
      const url = formType === 'ADD' ? '/api/cau-hinh' : `/api/cau-hinh/${id}`;
      const method = formType === 'ADD' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');

      setFormSuccess(data.message || 'Lưu cấu hình danh mục thành công!');
      fetchData(); // Reload list

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (catId, catName) => {
    if (confirm(`Bạn có chắc chắn muốn XÓA danh mục "${catName}" [${catId}]?\nCảnh báo: Hành động này không thể hoàn tác nếu danh mục đang được sử dụng ở phiếu cũ.`)) {
      try {
        const res = await fetch(`/api/cau-hinh/${catId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Xóa thất bại.');

        alert(`Đã xóa danh mục "${catName}" thành công.`);
        fetchData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // --- CÁC HÀM XỬ LÝ NHÓM ---
  const handleOpenAddGroup = (type) => {
    setGroupFormType('ADD');
    
    // Tự sinh mã gợi ý (C... hoặc T...)
    if (type === 'CHI') {
      const chiGroups = groups.filter(g => g.id.toUpperCase().startsWith('C'));
      setGroupId(`C${chiGroups.length + 1}`);
    } else {
      const thuGroups = groups.filter(g => g.id.toUpperCase().startsWith('T') || g.id.toUpperCase().startsWith('THU'));
      setGroupId(`T${thuGroups.length + 1}`);
    }
    
    setGroupName('');
    setGroupOrder((groups.length + 1).toString());
    setGroupFormError('');
    setGroupFormSuccess('');
    setIsGroupModalOpen(true);
  };


  const handleOpenEditGroup = (g) => {
    setGroupFormType('EDIT');
    setGroupId(g.id);
    setGroupName(g.tenNhom);
    setGroupOrder(g.thuTu.toString());
    setGroupFormError('');
    setGroupFormSuccess('');
    setIsGroupModalOpen(true);
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    setGroupFormError('');
    setGroupFormSuccess('');

    if (!groupId || !groupName || !groupOrder) {
      setGroupFormError('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }

    const gId = groupId.trim().toUpperCase();
    if (!gId.startsWith('C') && !gId.startsWith('T') && !gId.startsWith('THU')) {
      setGroupFormError('Mã nhóm bắt buộc phải bắt đầu bằng chữ C (Nhóm Chi) hoặc chữ T (Nhóm Thu).');
      return;
    }


    setGroupFormLoading(true);

    const payload = {
      id: groupId.trim(),
      tenNhom: groupName.trim(),
      thuTu: parseInt(groupOrder) || 99
    };

    try {
      const url = groupFormType === 'ADD' ? '/api/cau-hinh-nhom' : `/api/cau-hinh-nhom/${groupId}`;
      const method = groupFormType === 'ADD' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');

      setGroupFormSuccess(data.message || 'Lưu cấu hình nhóm thành công!');
      fetchData(); // Reload list

      setTimeout(() => {
        setIsGroupModalOpen(false);
      }, 1000);
    } catch (err) {
      setGroupFormError(err.message);
    } finally {
      setGroupFormLoading(false);
    }
  };

  const handleDeleteGroup = async (gId, gName) => {
    if (confirm(`Bạn có chắc chắn muốn XÓA nhóm danh mục "${gName}" [${gId}]?\nCảnh báo: Chỉ có thể xóa nếu nhóm này không chứa bất kỳ danh mục con nào.`)) {
      try {
        const res = await fetch(`/api/cau-hinh-nhom/${gId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Xóa thất bại.');

        alert(`Đã xóa nhóm danh mục "${gName}" thành công.`);
        fetchData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // --- CÁC HÀM XỬ LÝ QUỸ ---
  const handleOpenAddFund = () => {
    setFundFormType('ADD');
    setFundId('');
    setFundTen('');
    setFundLoai('TIEN_MAT');
    setFundSoDu('0');
    setFundTrangThai('ACTIVE');
    setFundFormError('');
    setFundFormSuccess('');
    setIsFundModalOpen(true);
  };

  const handleOpenEditFund = (fund) => {
    setFundFormType('EDIT');
    setFundId(fund.id);
    setFundTen(fund.tenQuy);
    setFundLoai(fund.loaiQuy);
    setFundSoDu(fund.soDuDauKy.toString());
    setFundTrangThai(fund.trangThai);
    setFundFormError('');
    setFundFormSuccess('');
    setIsFundModalOpen(true);
  };

  const handleFundSubmit = async (e) => {
    e.preventDefault();
    setFundFormError('');
    setFundFormSuccess('');
    if (!fundId || !fundTen || !fundLoai) {
      setFundFormError('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }
    setFundFormLoading(true);
    try {
      const url = fundFormType === 'ADD' ? '/api/quy' : `/api/quy/${fundId}`;
      const method = fundFormType === 'ADD' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fundId, tenQuy: fundTen, loaiQuy: fundLoai, soDuDauKy: Number(fundSoDu) || 0, trangThai: fundTrangThai }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');
      setFundFormSuccess(data.message || 'Lưu quỹ thành công!');
      fetchData();
      setTimeout(() => setIsFundModalOpen(false), 1000);
    } catch (err) {
      setFundFormError(err.message);
    } finally {
      setFundFormLoading(false);
    }
  };

  const handleDeleteFund = async (fId, fName) => {
    if (confirm(`Bạn có chắc muốn XÓA quỹ "${fName}" [${fId}]?\nChỉ xóa được nếu quỹ chưa có phiếu thu-chi nào.`)) {
      try {
        const res = await fetch(`/api/quy/${fId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Xóa thất bại.');
        alert(`Đã xóa quỹ "${fName}" thành công.`);
        fetchData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải cấu hình hệ thống...</p>
      </div>
    );
  }

  const formatVND = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  // Filter Categories into Thu & Chi
  const thuCategories = categories.filter(c => c.loaiGiaoDich === 'THU');
  const chiCategories = categories.filter(c => c.loaiGiaoDich === 'CHI');

  // Lọc các nhóm chi phí (bắt đầu bằng 'C') và nhóm thu (bắt đầu bằng 'T') để hiển thị đồng bộ
  const chiGroupList = groups.filter(g => g.id.toUpperCase().startsWith('C'));
  const thuGroupList = groups.filter(g => g.id.toUpperCase().startsWith('T') || g.id.toUpperCase().startsWith('THU'));

  // Group Expense (CHI) by Cost Group (NCP)
  const chiGroups = {};
  chiGroupList.forEach(g => {
    chiGroups[g.id] = {
      groupName: g.tenNhom,
      items: chiCategories.filter(c => c.nhomChiPhiId === g.id)
    };
  });

  // Group Revenue (THU) by Revenue Group
  const thuGroups = {};
  thuGroupList.forEach(g => {
    thuGroups[g.id] = {
      groupName: g.tenNhom,
      items: thuCategories.filter(c => c.nhomChiPhiId === g.id)
    };
  });

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Cấu Hình Hệ Thống</h1>
            <p className={styles.pageDesc}>Thiết lập danh mục Thu-Chi, nhóm chi phí và phân quyền chọn danh mục</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleOpenAddFund} className="btn btn-secondary">
              <Wallet size={18} />
              <span>Thêm quỹ</span>
            </button>
            <button onClick={handleOpenAdd} className="btn btn-primary">
              <Plus size={20} />
              <span>Thêm danh mục mới</span>
            </button>
          </div>
        </div>

        {dataLoading ? (
          <div className={styles.loaderContainer} style={{ minHeight: '300px' }}>
            <div className={styles.spinner}></div>
            <p>Đang tải danh mục cấu hình...</p>
          </div>
        ) : (
          <>
            <div className={styles.twoColumnLayout}>
              {/* COLUMN 1: DANH MỤC THU (Đã tách riêng biệt thành 3 nhóm) */}
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>
                    <TrendingUp className={styles.panelIcon} size={22} />
                    <span>Danh Mục Thu</span>
                  </div>
                  <span className="badge badge-paid" style={{ background: 'var(--success-bg)', color: '#4b6656' }}>
                    {thuCategories.length} Mục Thu
                  </span>
                </div>

                {Object.keys(thuGroups).map((gId) => {
                  const g = thuGroups[gId];
                  return (
                    <div key={gId} className={styles.groupCard}>
                      <div className={styles.groupHeader}>
                        <div className={styles.groupTitle}>
                          <Layers size={16} />
                          <span>{g.groupName}</span>
                        </div>
                      </div>

                      <div className={styles.categoryList}>
                        {g.items.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Chưa có danh mục thu nào trong nhóm này.</p>
                        ) : (
                          g.items.map((cat) => {
                            let roles = [];
                            try { roles = JSON.parse(cat.chucVuDuocXem); } catch(e) {}
                            return (
                              <div key={cat.id} className={styles.categoryItem}>
                                <div className={styles.categoryInfo}>
                                  <span className={styles.categoryName}>[{cat.id}] {cat.tenDanhMuc}</span>
                                  <div className={styles.categoryMeta}>
                                    {roles.map(r => (
                                      <span key={r} className={styles.badgeRole}>{r}</span>
                                    ))}
                                    {cat.trangThai === 'INACTIVE' && (
                                      <span className={styles.badgeRole} style={{ background: '#cf8d8d', color: '#fff' }}>Khóa</span>
                                    )}
                                  </div>
                                </div>
                                <div className={styles.actionButtons}>
                                  <button onClick={() => handleOpenEdit(cat)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Sửa">
                                    <Edit3 size={15} />
                                  </button>
                                  <button onClick={() => handleDelete(cat.id, cat.tenDanhMuc)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Xóa">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* COLUMN 2: DANH MỤC CHI */}
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelTitle}>
                    <TrendingDown className={styles.panelIcon} size={22} />
                    <span>Danh Mục Chi</span>
                  </div>
                  <span className="badge badge-cancelled" style={{ background: 'var(--danger-bg)', color: '#8c5353' }}>
                    {chiCategories.length} Mục Chi
                  </span>
                </div>

                {Object.keys(chiGroups).map((gId) => {
                  const g = chiGroups[gId];
                  return (
                    <div key={gId} className={styles.groupCard}>
                      <div className={styles.groupHeader}>
                        <div className={styles.groupTitle}>
                          <Layers size={16} />
                          <span>{g.groupName}</span>
                        </div>
                      </div>

                      <div className={styles.categoryList}>
                        {g.items.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Chưa có danh mục chi nào trong nhóm này.</p>
                        ) : (
                          g.items.map((cat) => {
                            let roles = [];
                            try { roles = JSON.parse(cat.chucVuDuocXem); } catch(e) {}
                            return (
                              <div key={cat.id} className={styles.categoryItem}>
                                <div className={styles.categoryInfo}>
                                  <span className={styles.categoryName}>[{cat.id}] {cat.tenDanhMuc}</span>
                                  <div className={styles.categoryMeta}>
                                    {roles.map(r => (
                                      <span key={r} className={styles.badgeRole}>{r}</span>
                                    ))}
                                    {cat.yeuCauNCC && (
                                      <span className={styles.badgeNcc}>Yêu Cầu NCC</span>
                                    )}
                                    {cat.hanMucThang && (
                                      <span style={{ fontSize: '0.7rem', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '4px', padding: '2px 6px' }}>
                                        HM: {Number(cat.hanMucThang).toLocaleString('vi-VN')}₫
                                      </span>
                                    )}
                                    {cat.trangThai === 'INACTIVE' && (
                                      <span className={styles.badgeRole} style={{ background: '#cf8d8d', color: '#fff' }}>Khóa</span>
                                    )}
                                  </div>
                                </div>
                                <div className={styles.actionButtons}>
                                  <button onClick={() => handleOpenEdit(cat)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Sửa">
                                    <Edit3 size={15} />
                                  </button>
                                  <button onClick={() => handleDelete(cat.id, cat.tenDanhMuc)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Xóa">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* HAI CỘT: QUẢN LÝ NHÓM THU VÀ NHÓM CHI */}
            <div className={styles.twoColumnLayout} style={{ marginTop: '2rem' }}>
              {/* CỘT 1: NHÓM DOANH MỤC THU */}
              <div className={styles.panel}>
                <div className={styles.panelHeader} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div className={styles.panelTitle}>
                    <TrendingUp className={styles.panelIcon} size={20} style={{ color: '#10b981' }} />
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Quản Lý Nhóm Thu</h2>
                  </div>
                  <button onClick={() => handleOpenAddGroup('THU')} className="btn btn-primary btn-sm" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
                    <Plus size={14} />
                    <span>Thêm nhóm Thu</span>
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '100px' }}>Mã Nhóm</th>
                        <th>Tên Nhóm Thu</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>Sắp xếp</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {thuGroupList.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có nhóm thu nào.</td>
                        </tr>
                      ) : (
                        thuGroupList.map((g) => (
                          <tr key={g.id}>
                            <td style={{ fontWeight: 'bold', color: '#10b981' }}>{g.id}</td>
                            <td style={{ fontWeight: '500' }}>{g.tenNhom}</td>
                            <td style={{ textAlign: 'center' }}>{g.thuTu}</td>
                            <td style={{ textAlign: 'center' }}>
                              <div className={styles.actionButtons} style={{ justifyContent: 'center' }}>
                                <button onClick={() => handleOpenEditGroup(g)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Sửa nhóm">
                                  <Edit3 size={14} />
                                </button>
                                <button onClick={() => handleDeleteGroup(g.id, g.tenNhom)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Xóa nhóm">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỘT 2: NHÓM DOANH MỤC CHI */}
              <div className={styles.panel}>
                <div className={styles.panelHeader} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div className={styles.panelTitle}>
                    <TrendingDown className={styles.panelIcon} size={20} style={{ color: '#ef4444' }} />
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Quản Lý Nhóm Chi</h2>
                  </div>
                  <button onClick={() => handleOpenAddGroup('CHI')} className="btn btn-primary btn-sm" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
                    <Plus size={14} />
                    <span>Thêm nhóm Chi</span>
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '100px' }}>Mã Nhóm</th>
                        <th>Tên Nhóm Chi</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>Sắp xếp</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chiGroupList.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có nhóm chi nào.</td>
                        </tr>
                      ) : (
                        chiGroupList.map((g) => (
                          <tr key={g.id}>
                            <td style={{ fontWeight: 'bold', color: '#ef4444' }}>{g.id}</td>
                            <td style={{ fontWeight: '500' }}>{g.tenNhom}</td>
                            <td style={{ textAlign: 'center' }}>{g.thuTu}</td>
                            <td style={{ textAlign: 'center' }}>
                              <div className={styles.actionButtons} style={{ justifyContent: 'center' }}>
                                <button onClick={() => handleOpenEditGroup(g)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Sửa nhóm">
                                  <Edit3 size={14} />
                                </button>
                                <button onClick={() => handleDeleteGroup(g.id, g.tenNhom)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Xóa nhóm">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            {/* PHẦN QUẢN LÝ QUỸ */}
            <div className={styles.panel} style={{ marginTop: '2rem' }}>
              <div className={styles.panelHeader} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div className={styles.panelTitle}>
                  <Wallet className={styles.panelIcon} size={20} style={{ color: 'var(--brand-brown)' }} />
                  <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Quản Lý Quỹ Tiền</h2>
                </div>
                <button onClick={handleOpenAddFund} className="btn btn-primary btn-sm" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
                  <Plus size={14} />
                  <span>Thêm quỹ mới</span>
                </button>
              </div>
              <div className="table-responsive">
                <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Mã Quỹ</th>
                      <th>Tên Quỹ</th>
                      <th>Loại Quỹ</th>
                      <th>Số dư đầu kỳ</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funds.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có quỹ nào.</td>
                      </tr>
                    ) : (
                      funds.map((fund) => (
                        <tr key={fund.id}>
                          <td style={{ fontWeight: 'bold', color: 'var(--brand-brown)' }}>{fund.id}</td>
                          <td style={{ fontWeight: '600' }}>{fund.tenQuy}</td>
                          <td>
                            {fund.loaiQuy === 'TIEN_MAT' && '💵 Tiền mặt'}
                            {fund.loaiQuy === 'NGAN_HANG' && '🏦 Ngân hàng'}
                            {fund.loaiQuy === 'CA_NHAN' && '👤 Cá nhân ứng'}
                          </td>
                          <td>{fund.soDuDauKy.toLocaleString('vi-VN')} ₫</td>
                          <td>
                            <span className={fund.trangThai === 'ACTIVE' ? 'badge badge-paid' : 'badge badge-cancelled'}>
                              {fund.trangThai === 'ACTIVE' ? 'Hoạt động' : 'Khóa'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className={styles.actionButtons} style={{ justifyContent: 'center' }}>
                              <button onClick={() => handleOpenEditFund(fund)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Sửa quỹ">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => handleDeleteFund(fund.id, fund.tenQuy)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Xóa quỹ">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* MODAL FORM: THÊM / SỬA DANH MỤC */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>{formType === 'ADD' ? 'Cấu hình Thêm Danh Mục Mới' : 'Cập nhật Cấu hình Danh Mục'}</h2>
                <button onClick={() => setIsModalOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {formError && (
                <div className={`${styles.alert} ${styles.errorAlert}`}>
                  <AlertCircle size={18} />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className={`${styles.alert} ${styles.successAlert}`}>
                  <Check size={18} />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                  <label className="form-label">Mã Danh Mục *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: C1.07 hoặc T01.06"
                    className="form-control"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    disabled={formLoading || formType === 'EDIT'}
                    required
                  />
                  {formType === 'ADD' && (
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                      Mã trơn viết liền không dấu, ví dụ: C1.07
                    </small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Tên Danh Mục *</label>
                  <input 
                    type="text" 
                    placeholder="Nhập tên danh mục chi tiết..."
                    className="form-control"
                    value={tenDanhMuc}
                    onChange={(e) => setTenDanhMuc(e.target.value)}
                    disabled={formLoading}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Loại Giao Dịch *</label>
                  <select
                    className="form-control"
                    value={loaiGiaoDich}
                    onChange={(e) => setLoaiGiaoDich(e.target.value)}
                    disabled={formLoading}
                  >
                    <option value="CHI">📉 Danh mục CHI</option>
                    <option value="THU">📈 Danh mục THU</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Nhóm Chi Phí / Nhóm Thu *</label>
                  <select
                    className="form-control"
                    value={nhomChiPhiId}
                    onChange={(e) => setNhomChiPhiId(e.target.value)}
                    disabled={formLoading}
                  >
                    {groups
                      .filter(g => {
                        if (loaiGiaoDich === 'CHI') {
                          return g.id.toUpperCase().startsWith('C');
                        } else {
                          return g.id.toUpperCase().startsWith('T') || g.id.toUpperCase().startsWith('THU');
                        }
                      })
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          [{g.id}] {g.tenNhom}
                        </option>
                      ))}

                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Phân Quyền Vai Trò Được Xem *</label>
                  <div className={styles.checkboxGroup}>
                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox"
                        checked={viewRoles.OWNER}
                        onChange={(e) => setViewRoles({ ...viewRoles, OWNER: e.target.checked })}
                        disabled={formLoading}
                      />
                      <span>Owner</span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox"
                        checked={viewRoles.MANAGER}
                        onChange={(e) => setViewRoles({ ...viewRoles, MANAGER: e.target.checked })}
                        disabled={formLoading}
                      />
                      <span>Manager</span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={viewRoles.LEADER}
                        onChange={(e) => setViewRoles({ ...viewRoles, LEADER: e.target.checked })}
                        disabled={formLoading}
                      />
                      <span>Leader</span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={viewRoles.STAFF}
                        onChange={(e) => setViewRoles({ ...viewRoles, STAFF: e.target.checked })}
                        disabled={formLoading}
                      />
                      <span>Staff</span>
                    </label>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Yêu Cầu NCC (Đối với đề xuất Chi)</label>
                  <label className={styles.checkboxLabel} style={{ marginTop: '0.5rem' }}>
                    <input 
                      type="checkbox"
                      checked={yeuCauNCC}
                      onChange={(e) => setYeuCauNCC(e.target.checked)}
                      disabled={formLoading || loaiGiaoDich === 'THU'}
                    />
                    <span>Bắt buộc phải gán nhà cung cấp khi làm phiếu đề xuất chi</span>
                  </label>
                </div>

                {loaiGiaoDich === 'CHI' && (
                  <div className={styles.formGroup}>
                    <label className="form-label">Hạn mức chi tháng (VND) — Tùy chọn</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      placeholder="Để trống nếu không giới hạn. Ví dụ: 10000000"
                      value={hanMucThang ? Number(hanMucThang).toLocaleString('vi-VN') : ''}
                      onChange={(e) => setHanMucThang(e.target.value.replace(/\D/g, ''))}
                      disabled={formLoading}
                    />
                    {hanMucThang && (
                      <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                        Cảnh báo khi đề xuất tháng này vượt {Number(hanMucThang).toLocaleString('vi-VN')} ₫
                      </small>
                    )}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className="form-label">Trạng Thái Hoạt Động</label>
                  <select
                    className="form-control"
                    value={trangThai}
                    onChange={(e) => setTrangThai(e.target.value)}
                    disabled={formLoading}
                  >
                    <option value="ACTIVE">Hoạt động (Active)</option>
                    <option value="INACTIVE">Khóa tạm thời (Inactive)</option>
                  </select>
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                    Đóng
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={formLoading}>
                    {formLoading ? 'Đang lưu...' : 'Lưu Danh Mục'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL FORM: THÊM / SỬA NHÓM DANH MỤC */}
        {isGroupModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>{groupFormType === 'ADD' ? 'Thêm Nhóm Danh Mục Mới' : 'Cập Nhật Nhóm Danh Mục'}</h2>
                <button onClick={() => setIsGroupModalOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {groupFormError && (
                <div className={`${styles.alert} ${styles.errorAlert}`}>
                  <AlertCircle size={18} />
                  <span>{groupFormError}</span>
                </div>
              )}

              {groupFormSuccess && (
                <div className={`${styles.alert} ${styles.successAlert}`}>
                  <Check size={18} />
                  <span>{groupFormSuccess}</span>
                </div>
              )}

              <form onSubmit={handleGroupSubmit}>
                <div className={styles.formGroup}>
                  <label className="form-label">Mã Nhóm *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: C8 hoặc T4"
                    className="form-control"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    disabled={groupFormLoading || groupFormType === 'EDIT'}
                    required
                  />
                  {groupFormType === 'ADD' && (
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                      Bắt đầu bằng chữ <strong>C</strong> (Nhóm Chi) hoặc chữ <strong>T</strong> (Nhóm Thu). Ví dụ: C8, T4
                    </small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Tên Nhóm *</label>
                  <input 
                    type="text" 
                    placeholder="Nhập tên nhóm..."
                    className="form-control"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    disabled={groupFormLoading}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Hệ thống tự động đồng bộ chữ HOA cho nhóm Chi, và viết hoa chữ đầu cho nhóm Thu.
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Thứ tự sắp xếp *</label>
                  <input 
                    type="number" 
                    placeholder="Ví dụ: 11"
                    className="form-control"
                    value={groupOrder}
                    onChange={(e) => setGroupOrder(e.target.value)}
                    disabled={groupFormLoading}
                    required
                  />
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={() => setIsGroupModalOpen(false)} className="btn btn-secondary" disabled={groupFormLoading}>
                    Đóng
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={groupFormLoading}>
                    {groupFormLoading ? 'Đang lưu...' : 'Lưu Nhóm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* MODAL FORM: THÊM / SỬA QUỸ */}
        {isFundModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>{fundFormType === 'ADD' ? 'Thêm Quỹ Mới' : 'Cập Nhật Quỹ'}</h2>
                <button onClick={() => setIsFundModalOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {fundFormError && (
                <div className={`${styles.alert} ${styles.errorAlert}`}>
                  <AlertCircle size={18} />
                  <span>{fundFormError}</span>
                </div>
              )}
              {fundFormSuccess && (
                <div className={`${styles.alert} ${styles.successAlert}`}>
                  <Check size={18} />
                  <span>{fundFormSuccess}</span>
                </div>
              )}

              <form onSubmit={handleFundSubmit}>
                <div className={styles.formGroup}>
                  <label className="form-label">Mã Quỹ *</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: QUY01, CASH, MB-BANK"
                    className="form-control"
                    value={fundId}
                    onChange={(e) => setFundId(e.target.value.toUpperCase())}
                    disabled={fundFormLoading || fundFormType === 'EDIT'}
                    required
                  />
                  {fundFormType === 'ADD' && (
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>Mã viết liền không dấu, viết hoa. Ví dụ: QUY01</small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Tên Quỹ *</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Quỹ tiền mặt shop"
                    className="form-control"
                    value={fundTen}
                    onChange={(e) => setFundTen(e.target.value)}
                    disabled={fundFormLoading}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Loại Quỹ *</label>
                  <select
                    className="form-control"
                    value={fundLoai}
                    onChange={(e) => setFundLoai(e.target.value)}
                    disabled={fundFormLoading}
                  >
                    <option value="TIEN_MAT">💵 Tiền mặt</option>
                    <option value="NGAN_HANG">🏦 Ngân hàng</option>
                    <option value="CA_NHAN">👤 Cá nhân ứng</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Số dư đầu kỳ (VND)</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="form-control"
                    value={fundSoDu}
                    onChange={(e) => setFundSoDu(e.target.value)}
                    disabled={fundFormLoading}
                    min={0}
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>Số tiền có trong quỹ trước khi bắt đầu sử dụng phần mềm.</small>
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Trạng Thái</label>
                  <select
                    className="form-control"
                    value={fundTrangThai}
                    onChange={(e) => setFundTrangThai(e.target.value)}
                    disabled={fundFormLoading}
                  >
                    <option value="ACTIVE">Hoạt động (Active)</option>
                    <option value="INACTIVE">Khóa tạm thời (Inactive)</option>
                  </select>
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={() => setIsFundModalOpen(false)} className="btn btn-secondary" disabled={fundFormLoading}>
                    Đóng
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={fundFormLoading}>
                    {fundFormLoading ? 'Đang lưu...' : 'Lưu Quỹ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
