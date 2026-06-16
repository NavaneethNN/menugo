import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1),
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

  const existing = await prisma.kitchen.findFirst({
    where: { id: params.id, restaurantId: auth.payload.restaurantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Kitchen not found' }, { status: 404 });
  }

  const kitchen = await prisma.kitchen.update({
    where: { id: params.id },
    data: { name: parse.data.name },
  });

  return NextResponse.json(kitchen);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const existing = await prisma.kitchen.findFirst({
    where: { id: params.id, restaurantId: auth.payload.restaurantId },
    include: {
      menuItems: { select: { id: true }, take: 1 },
      staff: { select: { id: true }, take: 1 },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Kitchen not found' }, { status: 404 });
  }

  if (existing.menuItems.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete kitchen with menu items' },
      { status: 409 }
    );
  }

  if (existing.staff.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete kitchen with assigned staff' },
      { status: 409 }
    );
  }

  await prisma.kitchen.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
