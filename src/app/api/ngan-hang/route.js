import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

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
  { tenVietTat: 'STB', tenDayDu: 'Sacombank' }
];

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Lazy seeding: if database has 0 banks, seed the 10 popular banks automatically!
    const count = await prisma.nganHang.count();
    if (count === 0) {
      await prisma.nganHang.createMany({
        data: POPULAR_BANKS
      });
    }

    const banks = await prisma.nganHang.findMany({
      orderBy: { tenVietTat: 'asc' }
    });

    return NextResponse.json(banks);
  } catch (error) {
    console.error('NganHang GET error:', error);
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
    console.error('NganHang POST error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
