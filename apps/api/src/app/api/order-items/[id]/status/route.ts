import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { computeOrderStatus } from '@/lib/order-status';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { status } = parse.data;

  const item = await prisma.orderItem.update({
    where: { id: params.id },
    data: {
      status,
      readyAt: status === 'READY' ? new Date() : undefined,
      servedAt: status === 'SERVED' ? new Date() : undefined,
    },
    include: { order: { include: { items: true } } },
  });

  // Recompute parent Order.status
  const newOrderStatus = computeOrderStatus(item.order.items.map((i) => i.status));

  await prisma.order.update({
    where: { id: item.orderId },
    data: { status: newOrderStatus },
  });

  return NextResponse.json({ ...item, order: { ...item.order, status: newOrderStatus } });
}
