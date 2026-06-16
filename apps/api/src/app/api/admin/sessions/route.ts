import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';

const querySchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
});

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  let payload;
  try {
    payload = await verifyStaffToken(token);
  } catch {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  if (payload.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { payload };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const parse = querySchema.safeParse({
    status: searchParams.get('status') || undefined,
  });

  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { status } = parse.data;

  const sessions = await prisma.tableSession.findMany({
    where: {
      table: { restaurantId: auth.payload.restaurantId },
      ...(status && { status }),
    },
    orderBy: { startedAt: 'desc' },
    include: {
      table: { select: { tableNumber: true } },
      orders: {
        include: {
          items: { select: { id: true } },
        },
      },
    },
  });

  const sessionsWithCounts = sessions.map((session) => ({
    id: session.id,
    tableNumber: session.table.tableNumber,
    seatsOccupied: session.seatsOccupied,
    status: session.status,
    startedAt: session.startedAt,
    closedAt: session.closedAt,
    closedBy: session.closedBy,
    orderCount: session.orders.length,
    totalItems: session.orders.reduce((sum, order) => sum + order.items.length, 0),
  }));

  return NextResponse.json(sessionsWithCounts);
}
