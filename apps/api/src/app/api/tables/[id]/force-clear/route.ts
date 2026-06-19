import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { emitEvent } from '@/lib/realtime';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload;
  try {
    payload = await verifyStaffToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'CASHIER' && payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const table = await prisma.table.findUnique({
    where: { id: params.id },
    select: { id: true, restaurantId: true, totalSeats: true },
  });

  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  if (table.restaurantId !== payload.restaurantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const activeSessions = await prisma.tableSession.findMany({
    where: { tableId: params.id, status: 'ACTIVE' },
    select: { id: true },
  });

  if (activeSessions.length === 0) {
    return NextResponse.json({ success: true, closedCount: 0 });
  }

  const sessionIds = activeSessions.map((s) => s.id);

  await prisma.tableSession.updateMany({
    where: { id: { in: sessionIds } },
    data: { status: 'CLOSED', closedAt: new Date(), closedBy: 'cashier' },
  });

  for (const session of activeSessions) {
    try {
      await emitEvent(`session:${session.id}`, 'session:closed', {
        tableSessionId: session.id,
      });
    } catch {}
  }

  await emitEvent(
    `restaurant:${table.restaurantId}:cashier`,
    'table:seats_updated',
    { tableId: table.id, availableSeats: table.totalSeats }
  );

  await emitEvent(
    `restaurant:${table.restaurantId}:admin`,
    'table:seats_updated',
    { tableId: table.id, availableSeats: table.totalSeats }
  );

  return NextResponse.json({ success: true, closedCount: sessionIds.length });
}
