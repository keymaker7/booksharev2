import { NextResponse } from 'next/server';
import { addApplicantsBatch } from '@/lib/books';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const applicantName = String(body.applicantName || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!applicantName) {
      return NextResponse.json({ error: '이름을 입력해 주세요' }, { status: 400 });
    }

    const parsed: { bookId: string; reason: string }[] = items.map(
      (item: { bookId?: string; reason?: string }) => ({
        bookId: String(item.bookId || '').trim(),
        reason: String(item.reason || '').trim(),
      }),
    );

    if (!parsed.length || parsed.some((item) => !item.bookId)) {
      return NextResponse.json({ error: '책을 하나 이상 선택해 주세요' }, { status: 400 });
    }

    const created = await addApplicantsBatch({ applicantName, items: parsed });
    return NextResponse.json({ success: true, count: created.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : '신청에 실패했어요';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
