import { NextResponse } from 'next/server';
import { buildCsv, getAdminDashboard } from '@/lib/admin';
import { adminNotConfigured, adminUnauthorized, verifyAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!process.env.ADMIN_SECRET) return adminNotConfigured();
  if (!verifyAdmin(request)) return adminUnauthorized();
  const data = await getAdminDashboard();
  const csv = buildCsv(data.books, data.applicants);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookshare_${date}.csv"`,
    },
  });
}
