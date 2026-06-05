import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

const utcDay = (nam, thang, day) => new Date(Date.UTC(nam, thang - 1, day, 0, 0, 0, 0));

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
        { error: 'Chỉ Chủ shop (Owner) mới có quyền nhập doanh thu ngày.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { nam, thang, rows } = body;

    const parsedNam = parseInt(nam, 10);
    const parsedThang = parseInt(thang, 10);

    if (isNaN(parsedNam) || parsedNam < 2000 || parsedNam > 2100) {
      return NextResponse.json({ error: 'Năm không hợp lệ.' }, { status: 400 });
    }
    if (isNaN(parsedThang) || parsedThang < 1 || parsedThang > 12) {
      return NextResponse.json({ error: 'Tháng không hợp lệ.' }, { status: 400 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu để nhập.' }, { status: 400 });
    }

    // Lấy các kênh bán đang hoạt động
    const kenhBans = await prisma.kenhBan.findMany({
      where: { trangThai: 'ACTIVE' },
    });
    // Bản đồ: Tên kênh bán chuẩn hóa -> Kênh bán
    const kenhBanMap = new Map(kenhBans.map((k) => [normName(k.tenKenh), k]));

    const lastDay = new Date(Date.UTC(parsedNam, parsedThang, 0)).getUTCDate();
    const errors = [];
    const itemsToInsert = [];

    rows.forEach((row, idx) => {
      const dong = idx + 2; // dòng trong Excel
      const { ngay } = row;

      const dayNum = parseInt(ngay, 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > lastDay) {
        errors.push({ dong, message: `Ngày ${ngay} không hợp lệ (phải từ 1 đến ${lastDay}).` });
        return;
      }

      // Duyệt các trường trong hàng (trừ trường 'ngay') để lấy thông tin doanh thu của các kênh
      Object.keys(row).forEach((key) => {
        if (key === 'ngay' || key === 'Ngay') return;

        const val = row[key];
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          if (isNaN(num) || num < 0) {
            errors.push({ dong, message: `Kênh "${key}" có giá trị doanh thu không hợp lệ (phải là số >= 0).` });
            return;
          }

          const kb = kenhBanMap.get(normName(key));
          if (!kb) {
            // Không báo lỗi cho các cột thừa không phải kênh bán (nếu có), hoặc báo nếu tên gần giống
            // Để linh hoạt, chỉ báo lỗi nếu cột đó có chứa giá trị mà không khớp kênh bán nào
            if (num > 0) {
              errors.push({ dong, message: `Cột "${key}" không khớp với tên kênh bán nào đang hoạt động.` });
            }
            return;
          }

          itemsToInsert.push({
            day: dayNum,
            kenhBanId: kb.id,
            soTien: num,
          });
        }
      });
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Dữ liệu Excel có lỗi, vui lòng kiểm tra.', errors, successCount: 0 },
        { status: 400 }
      );
    }

    if (itemsToInsert.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy dữ liệu doanh thu nào để lưu.' }, { status: 400 });
    }

    // 1) Bulk upsert doanh thu ngày bằng executeRaw
    const now = new Date();
    const sqlRows = itemsToInsert.map((it) =>
      Prisma.sql`(${randomUUID()}, ${utcDay(parsedNam, parsedThang, it.day)}, ${it.kenhBanId}, ${it.soTien}, ${now})`
    );

    await prisma.$executeRaw`
      INSERT INTO "DoanhThuHangNgay" ("id", "ngay", "kenhBanId", "soTien", "updatedAt")
      VALUES ${Prisma.join(sqlRows)}
      ON CONFLICT ("ngay", "kenhBanId")
      DO UPDATE SET "soTien" = EXCLUDED."soTien", "updatedAt" = EXCLUDED."updatedAt"
    `;

    // 2) Đồng bộ doanh thu tháng của các kênh lên KeHoachDoanhThu.thucTe
    const start = utcDay(parsedNam, parsedThang, 1);
    const end = utcDay(parsedNam, parsedThang + 1, 1);
    const grouped = await prisma.doanhThuHangNgay.groupBy({
      by: ['kenhBanId'],
      where: { ngay: { gte: start, lt: end } },
      _sum: { soTien: true },
    });

    const syncOps = grouped.map((g) =>
      prisma.keHoachDoanhThu.upsert({
        where: {
          nam_thang_kenhBanId: { nam: parsedNam, thang: parsedThang, kenhBanId: g.kenhBanId },
        },
        update: { thucTe: g._sum.soTien || 0 },
        create: {
          nam: parsedNam,
          thang: parsedThang,
          kenhBanId: g.kenhBanId,
          chiTieu: 0,
          thucTe: g._sum.soTien || 0,
        },
      })
    );

    if (syncOps.length > 0) {
      await prisma.$transaction(syncOps);
    }

    // Ghi nhật ký
    await ghiNhatKy({
      user,
      hanhDong: 'SUA',
      doiTuong: 'DOANH_THU',
      maDoiTuong: `DT-${parsedNam}-${parsedThang}`,
      moTa: `Nhập doanh thu ngày tháng ${parsedThang}/${parsedNam} từ file Excel (${itemsToInsert.length} bản ghi)`,
    });

    return NextResponse.json({
      success: true,
      successCount: itemsToInsert.length,
      message: `Đã nhập thành công ${itemsToInsert.length} bản ghi doanh thu ngày cho tháng ${parsedThang}/${parsedNam}.`,
    });
  } catch (error) {
    logger.error('POST /api/doanh-thu/import-hang-ngay', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
