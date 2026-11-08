import { NextResponse } from 'next/server';
import { listBooksByOwner } from '@/lib/books';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerName = searchParams.get('ownerName') || '';
  if (!ownerName.trim()) {
    return NextResponse.json({ error: 'ownerName이 필요해요' }, { status: 400 });
  }
  return NextResponse.json(await listBooksByOwner(ownerName));
}
