import { NextResponse } from 'next/server';
import { adminDeleteBook } from '@/lib/admin';
import { adminNotConfigured, adminUnauthorized, verifyAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  if (!process.env.ADMIN_SECRET) return adminNotConfigured();
  if (!verifyAdmin(request)) return adminUnauthorized();
  try {
    const { id } = await params;
    await adminDeleteBook(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '삭제 실패';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
