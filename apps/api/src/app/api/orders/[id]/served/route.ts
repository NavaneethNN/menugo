import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { computeOrderStatus } from '@/lib/order-status';
import { verifyStaffToken } from '@/lib/auth';
import { emitEvent } from '@/lib/realtime';
import { z } from 'zod';

const schema = z.object({
  itemIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let staffPayload;
  try {
    staffPayload = await verifyStaffToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (staffPayload.role !== 'WAITER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { itemIds } = parse.data;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { 
      items: true,
      tableSession: { 
        include: { table: { select: { restaurantId: true } } } 
      } 
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.tableSession.table.restaurantId !== staffPayload.restaurantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targetItemIds =
    itemIds && itemIds.length > 0
      ? itemIds
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

  // Emit order completed event when order becomes COMPLETED
  if (newOrderStatus === 'COMPLETED') {
    await emitEvent(
      `session:${order.tableSessionId}`,
      'order:completed',
      {
        orderId: order.id,
      }
    );
  }

  return NextResponse.json(updated);
}
