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

  if (payload.role !== 'CASHIER' && payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tables = await prisma.table.findMany({
    where: { restaurantId: payload.restaurantId },
    orderBy: { tableNumber: 'asc' },
    include: {
      sessions: {
        where: { status: 'ACTIVE' },
        include: {
          orders: {
            include: {
              items: {
                include: {
                  menuItem: { select: { name: true, price: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const now = new Date();

  const result = tables.map((table) => {
    const occupiedSeats = table.sessions.reduce((acc, s) => acc + s.seatsOccupied, 0);
    const availableSeats = table.totalSeats - occupiedSeats;

    const activeSessions = table.sessions.map((session) => {
      const durationMinutes = Math.round(
        (now.getTime() - session.startedAt.getTime()) / 60_000
      );

      const orders = session.orders.map((order) => {
        const items = order.items.map((item) => {
          const price = Number(item.menuItem.price);
          const subtotal = (price * item.quantity).toFixed(2);
          return {
            name: item.menuItem.name,
            quantity: item.quantity,
            price: price.toFixed(2),
            subtotal,
            status: item.status,
          };
        });
        return {
          orderId: order.id,
          placedAt: order.createdAt,
          items,
        };
      });

      const allItems = session.orders.flatMap((o) => o.items);
      const sessionTotal = allItems
        .reduce((acc, item) => acc + Number(item.menuItem.price) * item.quantity, 0)
        .toFixed(2);
      const allServed = allItems.length > 0 && allItems.every((i) => i.status === 'SERVED');

      return {
        sessionId: session.id,
        seatsOccupied: session.seatsOccupied,
        startedAt: session.startedAt,
        durationMinutes,
        orders,
        sessionTotal,
        allServed,
      };
    });

    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      totalSeats: table.totalSeats,
      availableSeats,
      activeSessions,
    };
  });

  return NextResponse.json(result);
}
