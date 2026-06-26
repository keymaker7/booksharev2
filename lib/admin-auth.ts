import { NextResponse } from 'next/server';

export function verifyAdmin(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return auth.slice(7) === secret;
}

export function adminUnauthorized() {
  return NextResponse.json({ error: '관리자 비밀번호가 올바르지 않아요' }, { status: 401 });
}

export function adminNotConfigured() {
  return NextResponse.json(
    { error: '서버에 ADMIN_SECRET이 설정되지 않았어요' },
    { status: 503 }
  );
}
