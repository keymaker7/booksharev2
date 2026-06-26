import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, message: '마음 나눔 책장 API 연결됨' });
}
