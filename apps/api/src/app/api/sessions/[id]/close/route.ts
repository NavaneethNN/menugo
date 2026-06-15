import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyStaffToken(token);
    if (!['CASHIER', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const session = await prisma.tableSession.update({
    where: { id: params.id, status: 'ACTIVE' },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy: 'cashier' },
  });

  return NextResponse.json({ success: true, sessionId: session.id });
}
