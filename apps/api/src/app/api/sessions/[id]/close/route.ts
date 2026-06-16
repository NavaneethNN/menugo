import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { emitEvent } from '@/lib/realtime';

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
    include: { 
      table: { 
        include: { 
          restaurant: true,
          sessions: {
            where: { status: 'ACTIVE' },
            select: { seatsOccupied: true },
          },
        } 
      } 
    },
  });

  // Emit session closed event to the session room
  await emitEvent(
    `session:${session.id}`,
    'session:closed',
    {
      tableSessionId: session.id,
    }
  );

  // Emit table seats updated event to cashier and admin rooms
  const occupiedSeats = session.table.sessions.reduce((acc, s) => acc + s.seatsOccupied, 0);
  const availableSeats = session.table.totalSeats - occupiedSeats;
  
  await emitEvent(
    `restaurant:${session.table.restaurantId}:cashier`,
    'table:seats_updated',
    {
      tableId: session.tableId,
      availableSeats,
    }
  );

  await emitEvent(
    `restaurant:${session.table.restaurantId}:admin`,
    'table:seats_updated',
    {
      tableId: session.tableId,
      availableSeats,
    }
  );

  return NextResponse.json({ success: true, sessionId: session.id });
}
