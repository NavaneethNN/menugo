import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@restaurant/db';
import { verifyStaffToken } from '@/lib/auth';
import QRCode from 'qrcode';

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const table = await prisma.table.findFirst({
    where: { id: params.id, restaurantId: auth.payload.restaurantId },
  });

  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  const pwaUrl = process.env.CUSTOMER_PWA_URL || 'http://localhost:3000';
  const scanUrl = `${pwaUrl}/scan/${table.qrToken}`;

  const qrDataUrl = await QRCode.toDataURL(scanUrl, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');

  return NextResponse.json({ qrBase64: base64, scanUrl });
}
