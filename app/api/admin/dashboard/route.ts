import { NextResponse } from 'next/server';
import { getAdminDashboard } from '@/lib/admin';
import { adminNotConfigured, adminUnauthorized, verifyAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!process.env.ADMIN_SECRET) return adminNotConfigured();
  if (!verifyAdmin(request)) return adminUnauthorized();
  return NextResponse.json(await getAdminDashboard());
}
