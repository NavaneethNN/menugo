import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import { WorkflowMode } from '@restaurant/shared-types';
import { z } from 'zod';

const updateSchema = z.object({
  workflowMode: z.enum(['ASSISTED_DINING', 'MANAGED_DINING', 'SELF_COLLECTION']),
});

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  let payload;
  try {
    payload = await verifyStaffToken(token);
  } catch {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  if (payload.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { payload };
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = updateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { workflowMode } = parse.data;

  const restaurant = await prisma.restaurant.update({
    where: { id: auth.payload.restaurantId },
    data: { workflowMode: workflowMode as WorkflowMode },
  });

  return NextResponse.json({ workflowMode: restaurant.workflowMode });
}
