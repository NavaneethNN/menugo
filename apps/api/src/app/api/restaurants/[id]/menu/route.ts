import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true, name: true, workflowMode: true },
  });

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const categories = await prisma.category.findMany({
    where: { restaurantId: id },
    orderBy: { sortOrder: 'asc' },
    include: {
      menuItems: {
        where: { isAvailable: true, restaurantId: id },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          imageUrl: true,
          isAvailable: true,
          kitchenId: true,
        },
      },
    },
  });

  return NextResponse.json({
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    workflowMode: restaurant.workflowMode,
    categories,
  });
}
