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

  const staffList = await prisma.staff.findMany({
    where: { restaurantId, isActive: true },
  });

  let matchedStaff = null;
  for (const staff of staffList) {
    if (await bcrypt.compare(pin, staff.pin)) {
      matchedStaff = staff;
      break;
    }
  }

  if (!matchedStaff) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await signStaffToken({
    staffId: matchedStaff.id,
    restaurantId: matchedStaff.restaurantId,
    role: matchedStaff.role,
    kitchenId: matchedStaff.kitchenId ?? undefined,
  });

  return NextResponse.json({
    token,
    staff: {
      id: matchedStaff.id,
      name: matchedStaff.name,
      role: matchedStaff.role,
      kitchenId: matchedStaff.kitchenId,
      restaurantId: matchedStaff.restaurantId,
    },
  });
}
