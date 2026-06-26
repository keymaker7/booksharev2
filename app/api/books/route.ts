import { NextResponse } from 'next/server';
import { createBook, listBooks, saveCoverFile } from '@/lib/books';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(await listBooks());
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const ownerName = String(form.get('ownerName') || '').trim();
    const title = String(form.get('title') || '').trim();
    const recommendation = String(form.get('recommendation') || '').trim();
    const cover = form.get('cover');

    if (!ownerName || !title || !recommendation) {
      return NextResponse.json({ error: '이름, 제목, 추천 이유를 모두 입력해 주세요' }, { status: 400 });
    }

    let coverUrl = '';
    if (cover instanceof File && cover.size > 0) {
      if (cover.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: '8MB 이하 사진만 가능해요' }, { status: 400 });
      }
      coverUrl = await saveCoverFile(cover);
    }

    const book = await createBook({ ownerName, title, recommendation, coverUrl });
    return NextResponse.json({ success: true, id: book.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : '등록에 실패했어요';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
