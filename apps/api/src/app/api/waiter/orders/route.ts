import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import type { OrderStatus } from '@restaurant/shared-types';

const STATUS_SORT_ORDER: Partial<Record<OrderStatus, number>> = {
  FULLY_READY: 0,
  PARTIALLY_READY: 1,
  PLACED: 2,
};

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload;
  try {
    payload = await verifyStaffToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'WAITER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orders = await prisma.order.findMany({
    where: {
      tableSession: {
        table: { restaurantId: payload.restaurantId },
      },
      OR: [
        {
          workflowMode: 'ASSISTED_DINING',
          status: 'PLACED',
        },
        {
          workflowMode: 'MANAGED_DINING',
          status: { in: ['PARTIALLY_READY', 'FULLY_READY'] },
        },
      ],
    },
    include: {
      tableSession: {
        include: { table: { select: { tableNumber: true } } },
      },
      items: {
        include: {
          menuItem: { select: { name: true } },
          kitchen: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const sorted = orders.sort((a, b) => {
    const aOrder = STATUS_SORT_ORDER[a.status as OrderStatus] ?? 99;
    const bOrder = STATUS_SORT_ORDER[b.status as OrderStatus] ?? 99;
    return aOrder - bOrder;
  });

  const response = sorted.map((order) => ({
    id: order.id,
    status: order.status,
    workflowMode: order.workflowMode,
    createdAt: order.createdAt,
    tableNumber: order.tableSession.table.tableNumber,
    items: order.items.map((item) => ({
      id: item.id,
      menuItemName: item.menuItem.name,
      kitchenName: item.kitchen.name,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions,
      status: item.status,
    })),
  }));

  return NextResponse.json(response);
}
