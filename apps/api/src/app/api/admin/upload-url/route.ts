import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const schema = z.object({
  filename: z.string().min(1),
  contentType: z.string().regex(/^image\//, 'Must be an image type'),
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

function sanitizeFilename(filename: string): string {
  const timestamp = Date.now();
  const clean = filename
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .toLowerCase();
  return `${timestamp}-${clean}`;
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { filename, contentType } = parse.data;

  const r2Endpoint = process.env.R2_ENDPOINT;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2BucketName = process.env.R2_BUCKET_NAME;
  const r2PublicUrl = process.env.R2_PUBLIC_URL;

  if (!r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName || !r2PublicUrl) {
    return NextResponse.json({ error: 'R2 configuration missing' }, { status: 500 });
  }

  const sanitizedFilename = sanitizeFilename(filename);

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: r2BucketName,
    Key: sanitizedFilename,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const publicUrl = `${r2PublicUrl}/${sanitizedFilename}`;

  return NextResponse.json({ uploadUrl, publicUrl });
}
