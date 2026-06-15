import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: {
          menuItem: { select: { name: true, imageUrl: true } },
          kitchen: { select: { name: true } },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json(order);
}
