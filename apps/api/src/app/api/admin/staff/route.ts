import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { StaffRole } from '@restaurant/shared-types';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const createSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'KITCHEN', 'WAITER', 'CASHIER']),
  pin: z.string().regex(/^\d{4,10}$/, 'PIN must be 4-10 digits'),
  kitchenId: z.string().optional(),
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

  const staff = await prisma.staff.findMany({
    where: { restaurantId: auth.payload.restaurantId },
    orderBy: { name: 'asc' },
    include: {
      kitchen: { select: { id: true, name: true } },
    },
  });

  const staffWithoutPin = staff.map(({ pin, ...rest }) => rest);

  return NextResponse.json(staffWithoutPin);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = createSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { name, role, pin, kitchenId } = parse.data;

  if (role === 'KITCHEN' && !kitchenId) {
    return NextResponse.json(
      { error: 'kitchenId is required for KITCHEN role' },
      { status: 400 }
    );
  }

  if (kitchenId) {
    const kitchen = await prisma.kitchen.findFirst({
      where: { id: kitchenId, restaurantId: auth.payload.restaurantId },
    });
    if (!kitchen) {
      return NextResponse.json({ error: 'Invalid kitchenId' }, { status: 400 });
    }
  }

  const hashedPin = await bcrypt.hash(pin, 10);

  const staff = await prisma.staff.create({
    data: {
      name,
      role: role as StaffRole,
      pin: hashedPin,
      kitchenId: kitchenId || null,
      restaurantId: auth.payload.restaurantId,
      isActive: true,
    },
    include: {
      kitchen: { select: { id: true, name: true } },
    },
  });

  const { pin: _, ...staffWithoutPin } = staff;

  return NextResponse.json(staffWithoutPin, { status: 201 });
}
