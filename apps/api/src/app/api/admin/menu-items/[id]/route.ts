import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  price: z.number().positive().optional(),
  imageUrl: z.string().url().optional().nullable(),
  categoryId: z.string().optional(),
  kitchenId: z.string().optional(),
  isAvailable: z.boolean().optional(),
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = updateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.menuItem.findFirst({
    where: { id: params.id, restaurantId: auth.payload.restaurantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
  }

  const { categoryId, kitchenId, ...rest } = parse.data;

  if (categoryId || kitchenId) {
    const { category, kitchen } = await validateCategoryAndKitchen(
      auth.payload.restaurantId,
      categoryId ?? existing.categoryId,
      kitchenId ?? existing.kitchenId
    );

    if (categoryId && !category) {
      return NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 });
    }

    if (kitchenId && !kitchen) {
      return NextResponse.json({ error: 'Invalid kitchenId' }, { status: 400 });
    }
  }

  const item = await prisma.menuItem.update({
    where: { id: params.id },
    data: { ...rest, ...(categoryId && { categoryId }), ...(kitchenId && { kitchenId }) },
    include: {
      category: { select: { id: true, name: true } },
      kitchen: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const existing = await prisma.menuItem.findFirst({
    where: { id: params.id, restaurantId: auth.payload.restaurantId },
    include: {
      orderItems: { select: { id: true }, take: 1 },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
  }

  if (existing.orderItems.length > 0) {
    const item = await prisma.menuItem.update({
      where: { id: params.id },
      data: { isAvailable: false },
    });
    return NextResponse.json({ softDeleted: true, item });
  }

  await prisma.menuItem.delete({ where: { id: params.id } });

  return NextResponse.json({ deleted: true });
}
