import { NextResponse } from 'next/server';
import { deleteBook } from '@/lib/books';
import { StoreReadError } from '@/lib/store';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

async function parseOwnerName(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.ownerName || '').trim();
    if (name) return name;
  } catch {
    /* DELETE 본문이 비어 있을 수 있음 */
  }
  return new URL(request.url).searchParams.get('ownerName')?.trim() || '';
}

export async function DELETE(request: Request, context: Params) {
  return handleDelete(request, context);
}

export async function POST(request: Request, context: Params) {
  return handleDelete(request, context);
}

async function handleDelete(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const ownerName = await parseOwnerName(request);
    if (!ownerName) {
      return NextResponse.json({ error: '등록자 이름이 필요해요' }, { status: 400 });
    }
    await deleteBook(id, ownerName);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof StoreReadError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : '삭제에 실패했어요';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
