import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifySessionToken } from '@/lib/auth';
import { computeOrderStatus } from '@/lib/order-status';
import { emitEvent } from '@/lib/realtime';
import { z } from 'zod';

const schema = z.object({
  sessionToken: z.string(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  let tokenPayload;
  try {
    tokenPayload = await verifySessionToken(parse.data.sessionToken);
  } catch {
    return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
  }

  const existing = await prisma.orderItem.findUnique({
    where: { id: params.id },
    include: {
      order: {
        select: {
          workflowMode: true,
          tableSessionId: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
  }

  if (existing.order.tableSessionId !== tokenPayload.sessionId) {
    return NextResponse.json({ error: 'Forbidden: item does not belong to your session' }, { status: 403 });
  }

  if (existing.order.workflowMode !== 'SELF_COLLECTION') {
    return NextResponse.json({ error: 'Customer collection only available in Self Collection mode' }, { status: 403 });
  }

  if (existing.status !== 'READY') {
    return NextResponse.json(
      { error: `Item must be READY to mark as collected. Current status: ${existing.status}` },
      { status: 400 }
    );
  }

  const item = await prisma.orderItem.update({
    where: { id: params.id },
    data: { status: 'SERVED', servedAt: new Date() },
    include: {
      order: {
        include: {
          items: true,
          tableSession: { include: { table: { include: { restaurant: true } } } },
        },
      },
    },
  });

  const newOrderStatus = computeOrderStatus(item.order.items.map((i) => i.status));
  await prisma.order.update({ where: { id: item.orderId }, data: { status: newOrderStatus } });

  const sessionId = item.order.tableSessionId;

  await emitEvent(`session:${sessionId}`, 'order_item:status_update', {
    orderItemId: item.id,
    status: 'SERVED',
  });

  if (newOrderStatus === 'COMPLETED') {
    try {
      await emitEvent(`session:${sessionId}`, 'order:completed', { orderId: item.orderId });
    } catch {}
  }

  return NextResponse.json({ success: true, orderItemId: item.id, newOrderStatus });
}
