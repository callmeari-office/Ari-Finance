import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { validateAnhHoaDon } from '@/lib/validateImage';
import { getSupabaseClient, STORAGE_BUCKET } from '@/lib/supabase';

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const body = await request.json();
    const { dataUrl } = body;

    if (!dataUrl) {
      return NextResponse.json({ error: 'Thiếu dữ liệu ảnh.' }, { status: 400 });
    }

    const imgError = validateAnhHoaDon(dataUrl);
    if (imgError) {
      return NextResponse.json({ error: imgError }, { status: 400 });
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    const mime = match[1];
    const buf = Buffer.from(match[2], 'base64');

    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
    const filename = `${randomUUID()}.${ext}`;

    const supabase = getSupabaseClient();

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, buf, { contentType: mime, upsert: false });

    if (uploadError) {
      logger.error('Upload ảnh Supabase Storage', uploadError);
      return NextResponse.json({ error: 'Upload ảnh thất bại. Vui lòng thử lại.' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    logger.error('POST /api/upload-anh', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
