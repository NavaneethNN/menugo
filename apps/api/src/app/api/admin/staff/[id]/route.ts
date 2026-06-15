import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { StaffRole } from '@restaurant/shared-types';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  pin: z.string().regex(/^\d{4,10}$/, 'PIN must be 4-10 digits').optional(),
  kitchenId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = updateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.staff.findFirst({
    where: { id: params.id, restaurantId: auth.payload.restaurantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  const { pin, kitchenId, ...rest } = parse.data;

  if (kitchenId !== undefined) {
    if (kitchenId) {
      const kitchen = await prisma.kitchen.findFirst({
        where: { id: kitchenId, restaurantId: auth.payload.restaurantId },
      });
      if (!kitchen) {
        return NextResponse.json({ error: 'Invalid kitchenId' }, { status: 400 });
      }
    }
    if (existing.role === 'KITCHEN' && !kitchenId) {
      return NextResponse.json(
        { error: 'KITCHEN staff must have a kitchenId' },
        { status: 400 }
      );
    }
  }

  const updateData: any = { ...rest };
  if (pin) {
    updateData.pin = await bcrypt.hash(pin, 10);
  }
  if (kitchenId !== undefined) {
    updateData.kitchenId = kitchenId;
  }

  const staff = await prisma.staff.update({
    where: { id: params.id },
    data: updateData,
    include: {
      kitchen: { select: { id: true, name: true } },
    },
  });

  const { pin: _, ...staffWithoutPin } = staff;

  return NextResponse.json(staffWithoutPin);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const existing = await prisma.staff.findFirst({
    where: { id: params.id, restaurantId: auth.payload.restaurantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  const staff = await prisma.staff.update({
    where: { id: params.id },
    data: { isActive: false },
    include: {
      kitchen: { select: { id: true, name: true } },
    },
  });

  const { pin: _, ...staffWithoutPin } = staff;

  return NextResponse.json(staffWithoutPin);
}
