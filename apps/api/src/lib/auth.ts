import { SignJWT, jwtVerify } from 'jose';
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

export interface SessionTokenPayload {
  sessionId: string;
  tableId: string;
  restaurantId: string;
}

export async function signStaffToken(payload: StaffTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
}

export async function verifyStaffToken(token: string): Promise<StaffTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as StaffTokenPayload;
}

export async function signSessionToken(payload: SessionTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as SessionTokenPayload;
}
