import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/backup — xuất toàn bộ dữ liệu nghiệp vụ ra JSON để sao lưu (OWNER only).
// LƯU Ý: cố tình BỎ QUA ảnh hóa đơn (anhHoaDon base64) và mật khẩu để file gọn & an toàn.
export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) mới được sao lưu dữ liệu.' },
        { status: 403 }
      );
    }

    const [
      nhanVien, quy, nhomChiPhi, danhMuc, nhaCungCap,
      deXuatChiPhi, thuChi, keHoach, kenhBan, keHoachDoanhThu, doanhThuHangNgay, nganHang,
    ] = await Promise.all([
      prisma.nhanVien.findMany({
        select: { id: true, hoTen: true, tenNgan: true, email: true, username: true, phone: true, phongBan: true, viTri: true, role: true, trangThai: true, createdAt: true },
        orderBy: { id: 'asc' },
      }),
      prisma.quy.findMany({ orderBy: { id: 'asc' } }),
      prisma.nhomChiPhi.findMany({ orderBy: { thuTu: 'asc' } }),
      prisma.danhMuc.findMany({ orderBy: { id: 'asc' } }),
      prisma.nhaCungCap.findMany({ orderBy: { id: 'asc' } }),
      prisma.deXuatChiPhi.findMany({
        select: { id: true, maPhieu: true, ngayPhatSinh: true, danhMucId: true, noiDung: true, soTien: true, nhaCungCapId: true, nguonTien: true, trangThai: true, quyThanhToanId: true, thuChiId: true, nguoiTaoId: true, nguoiDuyetId: true, ngayThanhToan: true, ghiChu: true, ngayTao: true, ngayCanThanhToan: true, laLichSu: true },
        orderBy: { ngayTao: 'desc' },
      }),
      prisma.thuChi.findMany({ orderBy: { ngayGiaoDich: 'desc' } }),
      prisma.keHoach.findMany({ orderBy: [{ nam: 'asc' }, { thang: 'asc' }] }),
      prisma.kenhBan.findMany({ orderBy: { thuTu: 'asc' } }),
      prisma.keHoachDoanhThu.findMany({ orderBy: [{ nam: 'asc' }, { thang: 'asc' }] }),
      prisma.doanhThuHangNgay.findMany({ orderBy: { ngay: 'asc' } }),
      prisma.nganHang.findMany({ orderBy: { tenVietTat: 'asc' } }),
    ]);

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      exportedBy: user.hoTen || user.username,
      data: {
        nhanVien, quy, nhomChiPhi, danhMuc, nhaCungCap,
        deXuatChiPhi, thuChi, keHoach, kenhBan, keHoachDoanhThu, doanhThuHangNgay, nganHang,
      },
    });
  } catch (error) {
    logger.error('GET /api/backup', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi khi sao lưu dữ liệu.' }, { status: 500 });
  }
}
