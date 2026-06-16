import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';

const toggleSchema = z.object({
  isAvailable: z.boolean(),
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
  const parse = toggleSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.menuItem.findFirst({
    where: { id: params.id, restaurantId: auth.payload.restaurantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
  }

  const item = await prisma.menuItem.update({
    where: { id: params.id },
    data: { isAvailable: parse.data.isAvailable },
    include: {
      category: { select: { id: true, name: true } },
      kitchen: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(item);
}
