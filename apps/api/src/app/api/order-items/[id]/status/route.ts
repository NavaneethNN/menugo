import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { computeOrderStatus } from '@/lib/order-status';
import { emitEvent } from '@/lib/realtime';
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
      } 
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
            tableNumber: item.order.tableSession.table.number,
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
            tableNumber: item.order.tableSession.table.number,
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
            tableNumber: item.order.tableSession.table.number,
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
