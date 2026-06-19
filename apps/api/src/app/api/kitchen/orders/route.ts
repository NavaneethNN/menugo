import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload;
  try {
    payload = await verifyStaffToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'KITCHEN' || !payload.kitchenId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const items = await prisma.orderItem.findMany({
    where: {
      kitchenId: payload.kitchenId,
      status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'] },
    },
    include: {
      menuItem: { select: { name: true, imageUrl: true } },
      order: {
        select: {
          workflowMode: true,
          tableSession: { include: { table: { select: { tableNumber: true } } } },
        },
      },
    },
    orderBy: { order: { createdAt: 'asc' } },
  });

  return NextResponse.json(items);
}
