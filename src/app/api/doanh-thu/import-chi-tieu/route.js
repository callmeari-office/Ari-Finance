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
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) mới có quyền nhập chỉ tiêu doanh thu.' },
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

    // Lấy danh sách kênh bán để đối soát tên
    const kenhBans = await prisma.kenhBan.findMany({
      where: { trangThai: 'ACTIVE' },
    });
    const kenhBanMap = new Map(kenhBans.map((k) => [normName(k.tenKenh), k]));

    const errors = [];
    const upsertItems = [];

    rows.forEach((row, idx) => {
      const dong = idx + 2; // dòng trong Excel
      const { kenhBan } = row;

      if (!kenhBan || !normName(kenhBan)) {
        errors.push({ dong, message: 'Thiếu tên Kênh bán.' });
        return;
      }

      const kb = kenhBanMap.get(normName(kenhBan));
      if (!kb) {
        errors.push({ dong, message: `Kênh bán "${kenhBan}" không tồn tại hoặc đã bị khóa.` });
        return;
      }

      // Duyệt qua 12 tháng
      for (let t = 1; t <= 12; t++) {
        const val = row[`T${t}`];
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          if (isNaN(num) || num < 0) {
            errors.push({ dong, message: `Tháng ${t} có giá trị chỉ tiêu không hợp lệ (phải là số >= 0).` });
            return;
          }
          upsertItems.push({
            kenhBanId: kb.id,
            thang: t,
            chiTieu: num,
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
      return NextResponse.json({ error: 'Không tìm thấy chỉ tiêu doanh thu nào để lưu.' }, { status: 400 });
    }

    // Thực hiện lưu hàng loạt vào database sử dụng transaction với timeout tăng lên 30s
    await prisma.$transaction(
      upsertItems.map((item) =>
        prisma.keHoachDoanhThu.upsert({
          where: {
            nam_thang_kenhBanId: {
              nam: parsedNam,
              thang: item.thang,
              kenhBanId: item.kenhBanId,
            },
          },
          update: {
            chiTieu: item.chiTieu,
          },
          create: {
            nam: parsedNam,
            thang: item.thang,
            kenhBanId: item.kenhBanId,
            chiTieu: item.chiTieu,
            thucTe: 0,
          },
        })
      ),
      {
        timeout: 30000
      }
    );

    // Ghi nhật ký
    await ghiNhatKy({
      user,
      hanhDong: 'SUA',
      doiTuong: 'DOANH_THU',
      maDoiTuong: `CT-${parsedNam}`,
      moTa: `Nhập chỉ tiêu doanh thu năm ${parsedNam} từ file Excel (${upsertItems.length} bản ghi)`,
    });

    return NextResponse.json({
      success: true,
      successCount: upsertItems.length,
      message: `Đã nhập thành công chỉ tiêu cho ${upsertItems.length} tháng/kênh bán của năm ${parsedNam}.`,
    });
  } catch (error) {
    logger.error('POST /api/doanh-thu/import-chi-tieu', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
