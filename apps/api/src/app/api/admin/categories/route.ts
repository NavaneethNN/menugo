import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
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

  const categories = await prisma.category.findMany({
    where: { restaurantId: auth.payload.restaurantId },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { menuItems: true },
      },
    },
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = createSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { name, sortOrder } = parse.data;

  const category = await prisma.category.create({
    data: {
      name,
      sortOrder,
      restaurantId: auth.payload.restaurantId,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
