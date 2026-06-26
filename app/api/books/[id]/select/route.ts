import { NextResponse } from 'next/server';
import { selectApplicant } from '@/lib/books';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const applicantId = String(body.applicantId || '').trim();
    const applicantName = String(body.applicantName || '').trim();
    const ownerName = String(body.ownerName || '').trim();

    if (!ownerName || (!applicantId && !applicantName)) {
      return NextResponse.json({ error: '이름 정보가 필요해요' }, { status: 400 });
    }

    await selectApplicant({
      bookId: id,
      applicantId: applicantId || undefined,
      applicantName: applicantName || undefined,
      ownerName,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '선택에 실패했어요';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
