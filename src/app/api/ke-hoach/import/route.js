import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Không có quyền truy cập.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { nam, rows } = body;

    const parsedNam = parseInt(nam, 10);
    if (isNaN(parsedNam) || parsedNam < 2000 || parsedNam > 2100) {
      return NextResponse.json({ error: 'Năm không hợp lệ.' }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu để nhập.' }, { status: 400 });
    }

    // Lấy danh sách danh mục CHI hoạt động để đối soát
    const categories = await prisma.danhMuc.findMany({
      where: { loaiGiaoDich: 'CHI', trangThai: 'ACTIVE' },
    });
    const categoryMap = new Map(categories.map((c) => [normName(c.tenDanhMuc), c]));

    const errors = [];
    const upsertItems = [];

    rows.forEach((row, idx) => {
      const dong = idx + 2; // dòng trong Excel
      const { danhMuc } = row;

      if (!danhMuc || !normName(danhMuc)) {
        errors.push({ dong, message: 'Thiếu tên Danh mục chi.' });
        return;
      }

      const cat = categoryMap.get(normName(danhMuc));
      if (!cat) {
        errors.push({ dong, message: `Danh mục "${danhMuc}" không tồn tại hoặc đã bị khóa.` });
        return;
      }

      // Duyệt qua 12 tháng
      for (let t = 1; t <= 12; t++) {
        const val = row[`T${t}`];
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          if (isNaN(num) || num < 0) {
            errors.push({ dong, message: `Tháng ${t} có giá trị kế hoạch không hợp lệ (phải là số >= 0).` });
            return;
          }
          upsertItems.push({
            danhMucId: cat.id,
            thang: t,
            soTien: num,
          });
        }
      }
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Dữ liệu Excel có lỗi, vui lòng kiểm tra.', errors, successCount: 0 },
        { status: 400 }
      );
    }

    if (upsertItems.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy kế hoạch chi phí nào để lưu.' }, { status: 400 });
    }

    // Lưu hàng loạt vào database bằng transaction với timeout 60s
    await prisma.$transaction(
      upsertItems.map((item) =>
        prisma.keHoach.upsert({
          where: {
            nam_thang_danhMucId: {
              nam: parsedNam,
              thang: item.thang,
              danhMucId: item.danhMucId,
            },
          },
          update: {
            soTien: item.soTien,
          },
          create: {
            nam: parsedNam,
            thang: item.thang,
            danhMucId: item.danhMucId,
            soTien: item.soTien,
          },
        })
      ),
      {
        timeout: 60000
      }
    );

    // Ghi nhật ký
    await ghiNhatKy({
      user,
      hanhDong: 'SUA',
      doiTuong: 'KE_HOACH',
      maDoiTuong: `KH-${parsedNam}`,
      moTa: `Nhập kế hoạch chi phí năm ${parsedNam} từ file Excel (${upsertItems.length} bản ghi)`,
    });

    return NextResponse.json({
      success: true,
      successCount: upsertItems.length,
      message: `Đã nhập thành công kế hoạch chi phí cho ${upsertItems.length} danh mục/tháng của năm ${parsedNam}.`,
    });
  } catch (error) {
    logger.error('POST /api/ke-hoach/import', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
