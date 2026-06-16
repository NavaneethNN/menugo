import { jwtVerify } from 'jose';
import type { StaffRole } from '@restaurant/shared-types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'change-me-in-production-please'
);

export interface StaffTokenPayload {
  staffId: string;
  restaurantId: string;
  role: StaffRole;
  kitchenId?: string;
}

export async function verifyToken(token: string): Promise<StaffTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as StaffTokenPayload;
}
