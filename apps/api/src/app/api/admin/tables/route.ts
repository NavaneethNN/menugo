import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const createSchema = z.object({
  tableNumber: z.string().min(1),
  totalSeats: z.number().int().min(1),
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

  const tables = await prisma.table.findMany({
    where: { restaurantId: auth.payload.restaurantId },
    orderBy: { tableNumber: 'asc' },
    include: {
      sessions: {
        where: { status: 'ACTIVE' },
        select: { seatsOccupied: true },
      },
    },
  });

  const tablesWithAvailability = tables.map((table) => {
    const occupiedSeats = table.sessions.reduce((sum, s) => sum + s.seatsOccupied, 0);
    return {
      id: table.id,
      tableNumber: table.tableNumber,
      totalSeats: table.totalSeats,
      qrToken: table.qrToken,
      activeSessions: table.sessions.length,
      availableSeats: table.totalSeats - occupiedSeats,
    };
  });

  return NextResponse.json(tablesWithAvailability);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = createSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { tableNumber, totalSeats } = parse.data;

  const existing = await prisma.table.findFirst({
    where: { restaurantId: auth.payload.restaurantId, tableNumber },
  });

  if (existing) {
    return NextResponse.json({ error: 'Table number already exists' }, { status: 409 });
  }

  const table = await prisma.table.create({
    data: {
      tableNumber,
      totalSeats,
      qrToken: randomUUID(),
      restaurantId: auth.payload.restaurantId,
    },
  });

  return NextResponse.json(table, { status: 201 });
}
