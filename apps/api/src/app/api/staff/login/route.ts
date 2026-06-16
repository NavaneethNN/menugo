import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { signStaffToken } from '@/lib/auth';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const schema = z.object({
  restaurantId: z.string(),
  pin: z.string().min(4).max(10),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { restaurantId, pin } = parse.data;

  const staff = await prisma.staff.findFirst({
    where: { restaurantId, isActive: true },
  });

  if (!staff || !(await bcrypt.compare(pin, staff.pin))) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await signStaffToken({
    staffId: staff.id,
    restaurantId: staff.restaurantId,
    role: staff.role,
    kitchenId: staff.kitchenId ?? undefined,
  });

  return NextResponse.json({
    token,
    staff: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      kitchenId: staff.kitchenId,
      restaurantId: staff.restaurantId,
    },
  });
}
