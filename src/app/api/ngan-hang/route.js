import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const POPULAR_BANKS = [
  { tenVietTat: 'VCB', tenDayDu: 'Vietcombank' },
  { tenVietTat: 'TCB', tenDayDu: 'Techcombank' },
  { tenVietTat: 'MB', tenDayDu: 'MBBank' },
  { tenVietTat: 'BIDV', tenDayDu: 'BIDV' },
  { tenVietTat: 'CTG', tenDayDu: 'VietinBank' },
  { tenVietTat: 'ACB', tenDayDu: 'ACB' },
  { tenVietTat: 'VPB', tenDayDu: 'VPBank' },
  { tenVietTat: 'HDB', tenDayDu: 'HDBank' },
  { tenVietTat: 'VIB', tenDayDu: 'VIB' },
  { tenVietTat: 'STB', tenDayDu: 'Sacombank' },
  { tenVietTat: 'TPB', tenDayDu: 'TPBank' },
  { tenVietTat: 'MSB', tenDayDu: 'MSB' },
  { tenVietTat: 'SHB', tenDayDu: 'SHBank' },
  { tenVietTat: 'EIB', tenDayDu: 'Eximbank' },
  { tenVietTat: 'OCB', tenDayDu: 'OCB' },
  { tenVietTat: 'LPB', tenDayDu: 'LPBank' },
  { tenVietTat: 'SCB', tenDayDu: 'SCB' },
  { tenVietTat: 'ABB', tenDayDu: 'ABBank' },
  { tenVietTat: 'NAB', tenDayDu: 'NamABank' },
  { tenVietTat: 'CAKE', tenDayDu: 'CAKE by VPBank' }
];

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Lazy seeding: seed missing popular banks automatically
    const count = await prisma.nganHang.count();
    if (count < POPULAR_BANKS.length) {
      await prisma.nganHang.createMany({
        data: POPULAR_BANKS,
        skipDuplicates: true
      });
    }

    const banks = await prisma.nganHang.findMany({
      orderBy: { tenDayDu: 'asc' }
    });

    return NextResponse.json(banks);
  } catch (error) {
    logger.error('GET /api/ngan-hang', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const body = await request.json();
    const { tenVietTat, tenDayDu } = body;

    if (!tenVietTat || !tenDayDu) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ Tên viết tắt và Tên đầy đủ của ngân hàng.' },
        { status: 400 }
      );
    }

    const vT = tenVietTat.trim().toUpperCase();
    const dD = tenDayDu.trim();

    // Check duplicate
    const exists = await prisma.nganHang.findUnique({
      where: { tenVietTat: vT }
    });

    if (exists) {
      return NextResponse.json(
        { error: `Tên viết tắt ngân hàng [${vT}] đã tồn tại trong danh mục.` },
        { status: 400 }
      );
    }

    const newBank = await prisma.nganHang.create({
      data: {
        tenVietTat: vT,
        tenDayDu: dD
      }
    });

    return NextResponse.json({
      success: true,
      bank: newBank,
      message: `Đã thêm ngân hàng ${vT} - ${dD} vào danh mục thành công.`
    });
  } catch (error) {
    logger.error('POST /api/ngan-hang', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
