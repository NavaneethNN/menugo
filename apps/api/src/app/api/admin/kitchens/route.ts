import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';

const createSchema = z.object({
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

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const kitchens = await prisma.kitchen.findMany({
    where: { restaurantId: auth.payload.restaurantId },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { menuItems: true, staff: true },
      },
    },
  });

  return NextResponse.json(kitchens);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = createSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { name } = parse.data;

  const kitchen = await prisma.kitchen.create({
    data: {
      name,
      restaurantId: auth.payload.restaurantId,
    },
  });

  return NextResponse.json(kitchen, { status: 201 });
}
