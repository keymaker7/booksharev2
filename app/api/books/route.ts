import { NextResponse } from 'next/server';
import { createBook, listBooks, saveCoverFile } from '@/lib/books';
import { LIMITS, trimField } from '@/lib/validation';
import { StoreReadError } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await listBooks());
  } catch (err) {
    if (err instanceof StoreReadError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const ownerName = trimField(String(form.get('ownerName') || ''), LIMITS.name, '이름');
    const title = trimField(String(form.get('title') || ''), LIMITS.title, '제목');
    const recommendation = trimField(
      String(form.get('recommendation') || ''),
      LIMITS.recommendation,
      '추천 이유',
    );
    const cover = form.get('cover');

    let coverUrl = '';
    if (cover instanceof File && cover.size > 0) {
      if (cover.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: '8MB 이하 사진만 가능해요' }, { status: 400 });
      }
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(cover.type)) {
        return NextResponse.json({ error: 'jpg, png, webp 사진만 가능해요' }, { status: 400 });
      }
      coverUrl = await saveCoverFile(cover);
    }

    const book = await createBook({ ownerName, title, recommendation, coverUrl });
    return NextResponse.json({ success: true, id: book.id, book });
  } catch (err) {
    if (err instanceof StoreReadError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : '등록에 실패했어요';
    const status = message.includes('입력') || message.includes('자') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
