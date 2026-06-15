import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const categories = await prisma.category.findMany({
    where: { restaurantId: id },
    orderBy: { sortOrder: 'asc' },
    include: {
      menuItems: {
        where: { isAvailable: true, restaurantId: id },
        orderBy: { name: 'asc' },
      },
    },
  });

  return NextResponse.json({ categories });
}
