import { NextResponse } from 'next/server';
import { addApplicant, listApplicants } from '@/lib/books';
import { StoreReadError } from '@/lib/store';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await listApplicants(id));
  } catch (err) {
    if (err instanceof StoreReadError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const applicantName = String(body.applicantName || '').trim();
    const reason = String(body.reason || '').trim();

    if (!applicantName || !reason) {
      return NextResponse.json({ error: '이름과 이유를 입력해 주세요' }, { status: 400 });
    }

    const applicant = await addApplicant({ bookId: id, applicantName, reason });
    return NextResponse.json({ success: true, id: applicant.id });
  } catch (err) {
    if (err instanceof StoreReadError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : '신청에 실패했어요';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
