import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional(),
  categoryId: z.string(),
  kitchenId: z.string(),
  isAvailable: z.boolean().default(true),
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

async function validateCategoryAndKitchen(
  restaurantId: string,
  categoryId: string,
  kitchenId: string
) {
  const [category, kitchen] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, restaurantId } }),
    prisma.kitchen.findFirst({ where: { id: kitchenId, restaurantId } }),
  ]);

  return { category, kitchen };
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const items = await prisma.menuItem.findMany({
    where: { restaurantId: auth.payload.restaurantId },
    orderBy: { name: 'asc' },
    include: {
      category: { select: { id: true, name: true } },
      kitchen: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = createSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { name, description, price, imageUrl, categoryId, kitchenId, isAvailable } = parse.data;

  const { category, kitchen } = await validateCategoryAndKitchen(
    auth.payload.restaurantId,
    categoryId,
    kitchenId
  );

  if (!category) {
    return NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 });
  }

  if (!kitchen) {
    return NextResponse.json({ error: 'Invalid kitchenId' }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: {
      name,
      description,
      price,
      imageUrl,
      categoryId,
      kitchenId,
      isAvailable,
      restaurantId: auth.payload.restaurantId,
    },
    include: {
      category: { select: { id: true, name: true } },
      kitchen: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(item, { status: 201 });
}
