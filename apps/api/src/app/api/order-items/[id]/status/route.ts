import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { computeOrderStatus } from '@/lib/order-status';
import { verifyStaffToken } from '@/lib/auth';
import { emitEvent } from '@/lib/realtime';
import { z } from 'zod';
import type { OrderItemStatus } from '@restaurant/shared-types';

const schema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED']),
});

const VALID_TRANSITIONS: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let staffPayload;
  try {
    staffPayload = await verifyStaffToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (staffPayload.role !== 'KITCHEN' || !staffPayload.kitchenId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { status } = parse.data;

  const existing = await prisma.orderItem.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
  }

  if (existing.kitchenId !== staffPayload.kitchenId) {
    return NextResponse.json({ error: 'Forbidden: item belongs to a different kitchen' }, { status: 403 });
  }

  const expectedNext = VALID_TRANSITIONS[existing.status as OrderItemStatus];
  if (status !== expectedNext) {
    return NextResponse.json(
      { error: `Invalid transition: ${existing.status} → ${status}. Expected: ${existing.status} → ${expectedNext ?? '(none)'}` },
      { status: 400 }
    );
  }

  const item = await prisma.orderItem.update({
    where: { id: params.id },
    data: {
      status,
      readyAt: status === 'READY' ? new Date() : undefined,
      servedAt: status === 'SERVED' ? new Date() : undefined,
    },
    include: { 
      order: { 
        include: { 
          items: { include: { menuItem: true } },
          tableSession: { 
            include: { 
              table: { 
                include: { restaurant: true } 
              } 
            } 
          } 
        } 
      },
      menuItem: true,
    },
  });

  // Recompute parent Order.status
  const newOrderStatus = computeOrderStatus(item.order.items.map((i) => i.status));

  await prisma.order.update({
    where: { id: item.orderId },
    data: { status: newOrderStatus },
  });

  // Emit events based on workflow mode and status changes
  const { workflowMode } = item.order.tableSession.table.restaurant;
  const restaurantId = item.order.tableSession.table.restaurantId;
  const sessionId = item.order.tableSessionId;

  // Always emit status update to session room
  await emitEvent(
    `session:${sessionId}`,
    'order_item:status_update',
    {
      orderItemId: item.id,
      status: status,
    }
  );

  // Handle workflow-specific events when item becomes READY
  if (status === 'READY') {
    if (workflowMode === 'MANAGED_DINING') {
      // Managed Dining: emit to waiter room
      if (newOrderStatus === 'PARTIALLY_READY') {
        const readyItems = item.order.items.filter(i => i.status === 'READY');
        const pendingItems = item.order.items.filter(i => i.status !== 'READY' && i.status !== 'SERVED');
        
        await emitEvent(
          `restaurant:${restaurantId}:waiter`,
          'order:partially_ready',
          {
            orderId: item.orderId,
            tableNumber: item.order.tableSession.table.tableNumber,
            readyItems: readyItems.map(i => ({
              orderItemId: i.id,
              name: i.menuItem.name,
              qty: i.quantity,
              specialInstructions: i.specialInstructions,
            })),
            pendingItems: pendingItems.map(i => ({
              orderItemId: i.id,
              name: i.menuItem.name,
              qty: i.quantity,
              specialInstructions: i.specialInstructions,
            })),
          }
        );
      } else if (newOrderStatus === 'FULLY_READY') {
        await emitEvent(
          `restaurant:${restaurantId}:waiter`,
          'order:fully_ready',
          {
            orderId: item.orderId,
            tableNumber: item.order.tableSession.table.tableNumber,
            items: item.order.items.map(i => ({
              orderItemId: i.id,
              name: i.menuItem.name,
              qty: i.quantity,
              specialInstructions: i.specialInstructions,
            })),
          }
        );
      }
    } else if (workflowMode === 'SELF_COLLECTION') {
      // Self Collection: emit item ready for pickup to session room
      await emitEvent(
        `session:${sessionId}`,
        'order:item_ready_for_pickup',
        {
          orderItemId: item.id,
          name: item.menuItem.name,
          kitchenName: `Kitchen ${item.kitchenId}`, // TODO: Get actual kitchen name
        }
      );

      // Also emit fully ready if all items are ready
      if (newOrderStatus === 'FULLY_READY') {
        await emitEvent(
          `session:${sessionId}`,
          'order:fully_ready',
          {
            orderId: item.orderId,
            tableNumber: item.order.tableSession.table.tableNumber,
            items: item.order.items.map(i => ({
              orderItemId: i.id,
              name: i.menuItem.name,
              qty: i.quantity,
              specialInstructions: i.specialInstructions,
            })),
          }
        );
      }
    }
  }

  return NextResponse.json({ ...item, order: { ...item.order, status: newOrderStatus } });
}
