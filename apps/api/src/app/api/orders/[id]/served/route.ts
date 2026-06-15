import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { computeOrderStatus } from '@/lib/order-status';
import { z } from 'zod';

const schema = z.object({
  orderItemIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { orderItemIds } = parse.data;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const targetItemIds =
    orderItemIds && orderItemIds.length > 0
      ? orderItemIds
      : order.items.map((i) => i.id);

  await prisma.orderItem.updateMany({
    where: { id: { in: targetItemIds }, orderId: params.id },
    data: { status: 'SERVED', servedAt: new Date() },
  });

  const updatedItems = await prisma.orderItem.findMany({ where: { orderId: params.id } });
  const newOrderStatus = computeOrderStatus(updatedItems.map((i) => i.status));

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { status: newOrderStatus },
    include: { items: true },
  });

  return NextResponse.json(updated);
}
