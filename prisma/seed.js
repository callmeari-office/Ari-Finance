const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu dọn dẹp database...');
  await prisma.session.deleteMany();
  await prisma.vaiTroQuyen.deleteMany();
  await prisma.deXuatChiPhi.deleteMany();
  await prisma.thuChi.deleteMany();
  await prisma.nhanVien.deleteMany();
  await prisma.quy.deleteMany();
  await prisma.danhMuc.deleteMany();
  await prisma.nhomChiPhi.deleteMany();
  await prisma.nhaCungCap.deleteMany();
  await prisma.keHoachDoanhThu.deleteMany();

  console.log('Tạo dữ liệu VaiTroQuyen (Phân quyền động mẫu)...');
  
  // Owner (Giám đốc)
  await prisma.vaiTroQuyen.create({
    data: {
      role: 'OWNER',
      permissions: JSON.stringify({
        tongQuan: true,
        deXuat: true,
        duyet: true,
        thuChi: true,
        quy: true,
        keHoach: true,
        doanhThu: true,
        baoCao: true,
        nhanSu: true,
        quyen: true,
        cauHinh: true
      })
    }
  });

  // Manager (Quản lý)
  await prisma.vaiTroQuyen.create({
    data: {
      role: 'MANAGER',
      permissions: JSON.stringify({
        tongQuan: true,
        deXuat: true,
        duyet: true,
        thuChi: true,
        quy: true,
        keHoach: true,
        doanhThu: true,
        baoCao: true,
        nhanSu: false,
        quyen: false,
        cauHinh: false
      })
    }
  });

  // Staff (Nhân viên) — mặc định chỉ thấy Tổng quan + Đề xuất chi phí.
  // Doanh thu / NCC / Kế hoạch chi phí: Chủ shop tự bật ở trang Quản lý Quyền khi cần.
  const staffPermissions = {
    tongQuan: true,
    deXuat: true,
    duyet: false,
    thuChi: false,
    quy: false,
    keHoach: false,
    keHoachDBThang: true,
    keHoachDBNam: true,
    doanhThu: false,
    doanhThuDBThang: true,
    doanhThuDBNam: true,
    loiNhuan: false,
    baoCao: false,
    ncc: false,
    nhanSu: false,
    quyen: false,
    cauHinh: false
  };
  await prisma.vaiTroQuyen.create({
    data: {
      role: 'STAFF',
      permissions: JSON.stringify(staffPermissions)
    }
  });

  // Leader (Trưởng nhóm) — sao chép y hệt quyền STAFF để chuẩn bị sẵn,
  // sau này có thể chỉnh khác STAFF ở trang Quản lý Quyền.
  await prisma.vaiTroQuyen.create({
    data: {
      role: 'LEADER',
      permissions: JSON.stringify(staffPermissions)
    }
  });

  console.log('Tạo dữ liệu Nhân Viên...');
  const salt = await bcrypt.genSalt(12);
  const hashOwner = await bcrypt.hash('owner123', salt);
  const hashManager = await bcrypt.hash('manager123', salt);
  const hashStaff = await bcrypt.hash('staff123', salt);
  const hashTest = await bcrypt.hash('test123', salt);

  // NV000 - Quản trị hệ thống (OWNER)
  const owner = await prisma.nhanVien.create({
    data: {
      id: 'NV000',
      hoTen: 'Quản trị hệ thống',
      tenNgan: 'Chủ shop',
      email: 'callmeari.office@gmail.com',
      username: 'owner',
      phone: '0123456789',
      phongBan: 'FINANCE & IT',
      viTri: 'Admin',
      matKhau: hashOwner,
      role: 'OWNER',
      trangThai: 'ACTIVE',
    },
  });

  // NV001 - Nguyễn Thị Trúc Linh (MANAGER)
  const manager = await prisma.nhanVien.create({
    data: {
      id: 'NV001',
      hoTen: 'Nguyễn Thị Trúc Linh',
      tenNgan: 'Trúc Linh',
      email: 'truclinh490@gmail.com',
      username: 'manager',
      phone: '0981279029',
      phongBan: 'PHÒNG KẾ TOÁN',
      viTri: 'Admin',
      matKhau: hashManager,
      role: 'MANAGER',
      trangThai: 'ACTIVE',
    },
  });

  // NV002 - Nguyễn Ngọc Bảo Nam (STAFF)
  const staff = await prisma.nhanVien.create({
    data: {
      id: 'NV002',
      hoTen: 'Nguyễn Ngọc Bảo Nam',
      tenNgan: 'Bảo Nam',
      email: 'nnbaonam96@gmail.com',
      username: 'staff',
      phone: '0909096174',
      phongBan: 'FINANCE & IT',
      viTri: 'Admin',
      matKhau: hashStaff,
      role: 'STAFF',
      trangThai: 'ACTIVE',
    },
  });

  // NV003 - Nhân viên kế toán (STAFF)
  const staffTest = await prisma.nhanVien.create({
    data: {
      id: 'NV003',
      hoTen: 'Nhân viên kế toán',
      tenNgan: 'Kế toán',
      email: 'test@demo.vn',
      username: 'test',
      phone: '0987654321',
      phongBan: 'PHÒNG KẾ TOÁN',
      viTri: 'Nhân viên kế toán',
      matKhau: hashTest,
      role: 'STAFF',
      trangThai: 'ACTIVE',
    },
  });

  console.log('Tạo dữ liệu Quỹ...');
  const quyTienMat = await prisma.quy.create({
    data: { id: 'Q_001', tenQuy: 'Tiền mặt shop', loaiQuy: 'TIEN_MAT', soDuDauKy: 5000000, trangThai: 'ACTIVE' }
  });
  const quyMB = await prisma.quy.create({
    data: { id: 'Q_002', tenQuy: 'MB Bank', loaiQuy: 'NGAN_HANG', soDuDauKy: 50000000, trangThai: 'ACTIVE' }
  });
  const quyVCB = await prisma.quy.create({
    data: { id: 'Q_003', tenQuy: 'VCB Bank', loaiQuy: 'NGAN_HANG', soDuDauKy: 50000000, trangThai: 'ACTIVE' }
  });
  const quyCaNhan = await prisma.quy.create({
    data: { id: 'Q_004', tenQuy: 'Tiền cá nhân (NV ứng)', loaiQuy: 'CA_NHAN', soDuDauKy: 0, trangThai: 'ACTIVE' }
  });

  console.log('Tạo dữ liệu Nhóm Thu - Chi (NCP)...');
  const nhoms = [
    { id: 'C1', tenNhom: 'GIÁ VỐN', thuTu: 1 },
    { id: 'C2', tenNhom: 'BÁN HÀNG', thuTu: 2 },
    { id: 'C3', tenNhom: 'NHÂN SỰ', thuTu: 3 },
    { id: 'C4', tenNhom: 'VẬN HÀNH', thuTu: 4 },
    { id: 'C5', tenNhom: 'TÀI CHÍNH', thuTu: 5 },
    { id: 'C6', tenNhom: 'KHẤU HAO', thuTu: 6 },
    { id: 'C7', tenNhom: 'KHÁC', thuTu: 7 },
    { id: 'T1', tenNhom: 'Thu từ hoạt động kinh doanh', thuTu: 8 },
    { id: 'T2', tenNhom: 'Thu từ hoạt động tài chính', thuTu: 9 },
    { id: 'T3', tenNhom: 'Thu khác', thuTu: 10 },
  ];

  for (const n of nhoms) {
    await prisma.nhomChiPhi.create({ data: n });
  }

  console.log('Tạo dữ liệu Danh Mục Thu - Chi...');
  const danhmucs = [
    // C1: GIÁ VỐN
    { id: 'C1.01', tenDanhMuc: 'Nguyên vật liệu, hàng hóa', nhomChiPhiId: 'C1', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: true },
    { id: 'C1.02', tenDanhMuc: 'Phí gia công, sản xuất', nhomChiPhiId: 'C1', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: true },
    { id: 'C1.03', tenDanhMuc: 'Thiết kế, rập mẫu', nhomChiPhiId: 'C1', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C1.04', tenDanhMuc: 'Vận chuyển nhập hàng', nhomChiPhiId: 'C1', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C1.05', tenDanhMuc: 'Bao bì, tem mác', nhomChiPhiId: 'C1', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C1.06', tenDanhMuc: 'Hao hụt hàng lỗi', nhomChiPhiId: 'C1', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },

    // C2: BÁN HÀNG
    { id: 'C2.01', tenDanhMuc: 'Marketing trực tiếp', nhomChiPhiId: 'C2', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C2.02', tenDanhMuc: 'Phí sàn, thanh toán', nhomChiPhiId: 'C2', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },
    { id: 'C2.03', tenDanhMuc: 'Phí vận chuyển khách', nhomChiPhiId: 'C2', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C2.04', tenDanhMuc: 'Quà tặng khách hàng', nhomChiPhiId: 'C2', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C2.05', tenDanhMuc: 'Hình ảnh thương hiệu', nhomChiPhiId: 'C2', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },

    // C3: NHÂN SỰ
    { id: 'C3.01', tenDanhMuc: 'Lương cố định', nhomChiPhiId: 'C3', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER'], yeuCauNCC: false },
    { id: 'C3.02', tenDanhMuc: 'Lương biến đổi', nhomChiPhiId: 'C3', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER'], yeuCauNCC: false },
    { id: 'C3.03', tenDanhMuc: 'Phúc lợi, bảo hiểm', nhomChiPhiId: 'C3', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER'], yeuCauNCC: false },

    // C4: VẬN HÀNH
    { id: 'C4.01', tenDanhMuc: 'Tiền thuê mặt bằng', nhomChiPhiId: 'C4', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },
    { id: 'C4.02', tenDanhMuc: 'Chi phí tiện ích', nhomChiPhiId: 'C4', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C4.03', tenDanhMuc: 'Chi phí cửa hàng', nhomChiPhiId: 'C4', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C4.04', tenDanhMuc: 'Chi phí văn phòng', nhomChiPhiId: 'C4', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'C4.05', tenDanhMuc: 'Công nghệ, phần mềm', nhomChiPhiId: 'C4', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },
    { id: 'C4.06', tenDanhMuc: 'Hành chính, lệ phí', nhomChiPhiId: 'C4', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },
    { id: 'C4.07', tenDanhMuc: 'Chi phí khác', nhomChiPhiId: 'C4', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },

    // C5: TÀI CHÍNH
    { id: 'C5.01', tenDanhMuc: 'Tiền vay ngân hàng', nhomChiPhiId: 'C5', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER'], yeuCauNCC: false },
    { id: 'C5.02', tenDanhMuc: 'Tiền vay cá nhân', nhomChiPhiId: 'C5', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER'], yeuCauNCC: false },

    // C6: KHẤU HAO
    { id: 'C6.01', tenDanhMuc: 'Khấu hao tài sản', nhomChiPhiId: 'C6', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER'], yeuCauNCC: false },

    // C7: KHÁC
    { id: 'C7.01', tenDanhMuc: 'Chi phí nội bộ', nhomChiPhiId: 'C7', loaiGiaoDich: 'CHI', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },

    // T1: Thu từ hoạt động kinh doanh
    { id: 'T01.01', tenDanhMuc: 'Thu từ bán hàng', nhomChiPhiId: 'T1', loaiGiaoDich: 'THU', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
    { id: 'T01.02', tenDanhMuc: 'Góp vốn, vay', nhomChiPhiId: 'T1', loaiGiaoDich: 'THU', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },
    { id: 'T01.03', tenDanhMuc: 'Hoàn tiền NCC', nhomChiPhiId: 'T1', loaiGiaoDich: 'THU', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },

    // T2: Thu từ hoạt động tài chính
    { id: 'T01.04', tenDanhMuc: 'Lãi đầu tư', nhomChiPhiId: 'T2', loaiGiaoDich: 'THU', chucVuDuocXem: ['OWNER', 'MANAGER'], yeuCauNCC: false },

    // T3: Thu khác
    { id: 'T01.05', tenDanhMuc: 'Thu khác', nhomChiPhiId: 'T3', loaiGiaoDich: 'THU', chucVuDuocXem: ['OWNER', 'MANAGER', 'STAFF'], yeuCauNCC: false },
  ];

  for (const dm of danhmucs) {
    await prisma.danhMuc.create({
      data: {
        id: dm.id,
        tenDanhMuc: dm.tenDanhMuc,
        nhomChiPhiId: dm.nhomChiPhiId,
        loaiGiaoDich: dm.loaiGiaoDich,
        chucVuDuocXem: JSON.stringify(dm.chucVuDuocXem),
        yeuCauNCC: dm.yeuCauNCC,
        trangThai: 'ACTIVE'
      }
    });
  }

  console.log('Tạo dữ liệu Nhà Cung Cấp...');
  const nccABC = await prisma.nhaCungCap.create({
    data: {
      id: 'NCC_001',
      tenNCC: 'Xưởng May ABC',
      soTaiKhoan: '1029384756',
      tenNganHang: 'Vietcombank',
    }
  });

  console.log('Tạo dữ liệu Đề Xuất Chi Phí mẫu...');
  // Đề xuất 1: Chờ thanh toán, TienShop (TH1)
  await prisma.deXuatChiPhi.create({
    data: {
      maPhieu: 'CP2605-0001',
      ngayPhatSinh: new Date('2026-05-26'),
      danhMucId: 'C1.01',
      noiDung: 'Đề xuất mua vải may đầm hoa mùa hè',
      soTien: 1500000,
      nhaCungCapId: 'NCC_001',
      nguonTien: 'TIEN_SHOP',
      trangThai: 'CHO_THANH_TOAN',
      nguoiTaoId: staff.id,
    }
  });

  // Đề xuất 2: Đã thanh toán sẵn, TienShop (TH2)
  await prisma.deXuatChiPhi.create({
    data: {
      maPhieu: 'CP2605-0002',
      ngayPhatSinh: new Date('2026-05-26'),
      danhMucId: 'C4.02',
      noiDung: 'Thanh toán tiền điện tháng 5 shop (Chờ gán quỹ)',
      soTien: 500000,
      nguonTien: 'TIEN_SHOP',
      trangThai: 'DA_THANH_TOAN',
      quyThanhToanId: null,
      thuChiId: null,
      nguoiTaoId: staff.id,
    }
  });

  // Đề xuất 3 & 4: Chờ hoàn ứng, TienCaNhan (dùng để test GỘP TH3)
  await prisma.deXuatChiPhi.create({
    data: {
      maPhieu: 'CP2605-0003',
      ngayPhatSinh: new Date('2026-05-27'),
      danhMucId: 'C1.01',
      noiDung: 'Nhân viên ứng tiền mua nút áo phụ',
      soTien: 300000,
      nhaCungCapId: 'NCC_001',
      nguonTien: 'TIEN_CA_NHAN',
      trangThai: 'CHO_HOAN_UNG',
      nguoiTaoId: staff.id,
    }
  });

  await prisma.deXuatChiPhi.create({
    data: {
      maPhieu: 'CP2605-0004',
      ngayPhatSinh: new Date('2026-05-27'),
      danhMucId: 'C1.01',
      noiDung: 'Nhân viên ứng tiền mua khóa kéo khẩn cấp',
      soTien: 700000,
      nhaCungCapId: 'NCC_001',
      nguonTien: 'TIEN_CA_NHAN',
      trangThai: 'CHO_HOAN_UNG',
      nguoiTaoId: staff.id,
    }
  });

  // Đề xuất 5: Đã hủy (4.Huy)
  await prisma.deXuatChiPhi.create({
    data: {
      maPhieu: 'CP2605-0005',
      ngayPhatSinh: new Date('2026-05-25'),
      danhMucId: 'C4.02',
      noiDung: 'Đề xuất mua trà sữa liên hoan (bị từ chối)',
      soTien: 200000,
      nguonTien: 'TIEN_SHOP',
      trangThai: 'HUY',
      nguoiTaoId: staff.id,
      ghiChu: 'Không duyệt chi liên hoan cá nhân.',
    }
  });

  console.log('Tạo dữ liệu Kênh Bán...');
  // Idempotent: chỉ seed kênh mặc định nếu bảng đang trống (giữ kênh do chủ shop tự thêm)
  const soKenhHienCo = await prisma.kenhBan.count();
  if (soKenhHienCo === 0) {
    const kenhBanDefaults = [
      { tenKenh: 'POS',        thuTu: 1, mauSac: '#6366f1' },
      { tenKenh: 'Shopee',     thuTu: 2, mauSac: '#f97316' },
      { tenKenh: 'Harasocial', thuTu: 3, mauSac: '#ec4899' },
      { tenKenh: 'Web',        thuTu: 4, mauSac: '#0ea5e9' },
      { tenKenh: 'Zalo',       thuTu: 5, mauSac: '#3b82f6' },
      { tenKenh: 'Instagram',  thuTu: 6, mauSac: '#a855f7' },
    ];
    for (const k of kenhBanDefaults) {
      await prisma.kenhBan.create({ data: { ...k, trangThai: 'ACTIVE' } });
    }
  } else {
    console.log(`  (Bỏ qua — đã có ${soKenhHienCo} kênh bán)`);
  }

  console.log('Seed dữ liệu thành công!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
