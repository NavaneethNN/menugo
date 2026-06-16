import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      tableSession: {
        include: { table: { select: { tableNumber: true } } },
      },
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

  return NextResponse.json({
    id: order.id,
    status: order.status,
    workflowMode: order.workflowMode,
    createdAt: order.createdAt,
    tableNumber: order.tableSession.table.tableNumber,
    items: order.items.map((item) => ({
      id: item.id,
      menuItemName: item.menuItem.name,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions,
      status: item.status,
      kitchenName: item.kitchen.name,
    })),
  });
}
