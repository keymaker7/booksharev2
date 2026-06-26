import { NextResponse } from 'next/server';
import { adminResetAll } from '@/lib/admin';
import { adminNotConfigured, adminUnauthorized, verifyAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!process.env.ADMIN_SECRET) return adminNotConfigured();
  if (!verifyAdmin(request)) return adminUnauthorized();
  await adminResetAll();
  return NextResponse.json({ success: true });
}
