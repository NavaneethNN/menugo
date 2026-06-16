import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifySessionToken } from '@/lib/auth';
import { emitEvent } from '@/lib/realtime';
import { z } from 'zod';

const schema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1),
        specialInstructions: z.string().optional(),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { sessionId, sessionToken, items } = parse.data;

  // Verify session token
  let tokenPayload;
  try {
    tokenPayload = await verifySessionToken(sessionToken);
  } catch {
    return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
  }

  if (tokenPayload.sessionId !== sessionId) {
    return NextResponse.json({ error: 'Session mismatch' }, { status: 401 });
  }

  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId, status: 'ACTIVE' },
    include: { table: { include: { restaurant: true } } },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found or closed' }, { status: 404 });
  }

  // Fetch menu items to copy kitchenId (denormalized, as per spec)
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId: session.table.restaurantId },
  });

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  // Validate all menu items exist and are available
  for (const item of items) {
    const mi = menuItemMap.get(item.menuItemId);
    if (!mi) {
      return NextResponse.json(
        { error: `Menu item ${item.menuItemId} not found` },
        { status: 400 }
      );
    }
    if (!mi.isAvailable) {
      return NextResponse.json(
        { error: `Menu item "${mi.name}" is currently unavailable` },
        { status: 400 }
      );
    }
  }

  const order = await prisma.order.create({
    data: {
      tableSessionId: sessionId,
      status: 'PLACED',
      workflowMode: session.table.restaurant.workflowMode,
      items: {
        create: items.map((item) => {
          const mi = menuItemMap.get(item.menuItemId)!;
          return {
            menuItemId: item.menuItemId,
            kitchenId: mi.kitchenId,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions ?? null,
            status: 'PENDING',
          };
        }),
      },
    },
    include: { items: { include: { menuItem: true } } },
  });

  // Emit events based on workflow mode
  const { workflowMode } = session.table.restaurant;
  const restaurantId = session.table.restaurantId;
  
  if (workflowMode === 'ASSISTED_DINING') {
    // Emit to waiter room for assisted dining
    await emitEvent(
      `restaurant:${restaurantId}:waiter`,
      'order:new_full',
      {
        orderId: order.id,
        tableNumber: session.table.tableNumber,
        items: order.items.map(item => ({
          orderItemId: item.id,
          name: item.menuItem.name,
          qty: item.quantity,
          specialInstructions: item.specialInstructions,
        })),
      }
    );
  } else {
    // Managed Dining and Self Collection: emit to individual kitchen rooms
    const kitchenGroups = new Map<string, typeof order.items>();
    
    for (const item of order.items) {
      const kitchenId = item.kitchenId;
      if (!kitchenGroups.has(kitchenId)) {
        kitchenGroups.set(kitchenId, []);
      }
      kitchenGroups.get(kitchenId)!.push(item);
    }

    for (const [kitchenId, kitchenItems] of kitchenGroups) {
      await emitEvent(
        `restaurant:${restaurantId}:kitchen:${kitchenId}`,
        'order:new',
        {
          orderId: order.id,
          tableNumber: session.table.tableNumber,
          items: kitchenItems.map(item => ({
            orderItemId: item.id,
            name: item.menuItem.name,
            qty: item.quantity,
            specialInstructions: item.specialInstructions,
            kitchenName: `Kitchen ${kitchenId}`, // TODO: Get actual kitchen name
          })),
        }
      );
    }
  }

  return NextResponse.json(order, { status: 201 });
}
