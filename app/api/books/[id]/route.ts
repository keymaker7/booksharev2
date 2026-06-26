import { NextResponse } from 'next/server';
import { deleteBook } from '@/lib/books';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ownerName = String(body.ownerName || '').trim();
    if (!ownerName) {
      return NextResponse.json({ error: '등록자 이름이 필요해요' }, { status: 400 });
    }
    await deleteBook(id, ownerName);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '삭제에 실패했어요';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
