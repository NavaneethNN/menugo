import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { signSessionToken } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  qrToken: z.string(),
  seatsOccupied: z.number().int().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { qrToken, seatsOccupied } = parse.data;

  const table = await prisma.table.findUnique({
    where: { qrToken },
    include: {
      restaurant: { select: { id: true, workflowMode: true } },
      sessions: {
        where: { status: 'ACTIVE' },
        select: { seatsOccupied: true },
      },
    },
  });

  if (!table) {
    return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 });
  }

  const occupiedSeats = table.sessions.reduce((acc, s) => acc + s.seatsOccupied, 0);
  const availableSeats = table.totalSeats - occupiedSeats;

  if (seatsOccupied > availableSeats) {
    return NextResponse.json(
      { error: 'Table Full', availableSeats, requestedSeats: seatsOccupied },
      { status: 409 }
    );
  }

  const session = await prisma.tableSession.create({
    data: {
      tableId: table.id,
      seatsOccupied,
      status: 'ACTIVE',
    },
  });

  const sessionToken = await signSessionToken({
    sessionId: session.id,
    tableId: table.id,
    restaurantId: table.restaurantId,
  });

  return NextResponse.json({
    sessionId: session.id,
    sessionToken,
    tableNumber: table.tableNumber,
    restaurantId: table.restaurantId,
    workflowMode: table.restaurant.workflowMode,
  });
}
