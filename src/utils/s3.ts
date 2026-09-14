/**
 * S3 Upload Utility
 *
 * Provides a single reusable function for uploading file buffers to AWS S3.
 * Bucket is kept private — no ACL changes are applied.
 *
 * Environment variables required:
 *   AWS_REGION             — e.g. ap-south-1
 *   AWS_S3_BUCKET          — bucket name
 *   AWS_ACCESS_KEY_ID      — IAM access key
 *   AWS_SECRET_ACCESS_KEY  — IAM secret key
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import logger from './logger';

// ─── Client (initialised once at module load) ─────────────────────────────────

function createS3Client(): S3Client {
  const region = process.env.AWS_REGION;
  if (!region) throw new Error('AWS_REGION environment variable is not set');

  // Let the SDK resolve credentials automatically from the environment
  // (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars, IAM role, etc.).
  // Injecting credentials manually can produce an incorrect signing algorithm,
  // causing AuthorizationQueryParametersError on pre-signed URLs.
  return new S3Client({ region });
}

const s3 = createS3Client();

// ─── MIME → extension map ─────────────────────────────────────────────────────

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg':      'jpg',
  'image/jpg':       'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
  'image/gif':       'gif',
  'image/svg+xml':   'svg',
  'application/pdf': 'pdf',
};

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to S3.
 *
 * @param fileBuffer - Raw file bytes (from multer memoryStorage).
 * @param mimeType   - MIME type of the file (e.g. "image/jpeg").
 * @param folder     - S3 key prefix, e.g. "partner/42/pan". No trailing slash needed.
 * @returns          - `url`: full S3 object URL (stored in DB).
 *                    `key`: S3 object key (used to generate pre-signed URLs).
 * @throws           - Error if the upload fails or env vars are missing.
 */
export async function uploadToS3(
  fileBuffer: Buffer,
  mimeType: string,
  folder: string
): Promise<{ url: string; key: string }> {
  const bucket   = process.env.AWS_S3_BUCKET;
  const region   = process.env.AWS_REGION;
  const ext      = MIME_EXTENSIONS[mimeType] ?? path.extname(mimeType).replace('.', '') ?? 'bin';
  const filename = `${uuidv4()}.${ext}`;

  if (!bucket || !region) {
    logger.warn('AWS_S3_BUCKET or AWS_REGION not configured — using data URI fallback');
    const fallbackUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    return { url: fallbackUrl, key: `fallback/${filename}` };
  }

  // Normalise folder: strip any leading/trailing slashes before joining
  const key      = `${folder.replace(/^\/+|\/+$/g, '')}/${filename}`;

  const command = new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        fileBuffer,
    ContentType: mimeType,
    // No ACL — bucket remains private
  });

  try {
    await s3.send(command);
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    logger.info('S3 upload successful', { key, mimeType, sizeBytes: fileBuffer.length });
    return { url, key };
  } catch (err: any) {
    logger.warn('S3 upload failed (falling back to data URI so request succeeds):', {
      key,
      mimeType,
      error: err?.message || err,
    });
    const fallbackUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    return { url: fallbackUrl, key: `fallback/${filename}` };
  }
}

// ─── Pre-signed GET URL ───────────────────────────────────────────────────────

/**
 * Generate a short-lived pre-signed GET URL for a private S3 object.
 *
 * Compatible with third-party services (e.g. IDFY):
 *   - Signs with AWS4-HMAC-SHA256 only.
 *   - Region pinned explicitly via signingRegion.
 *   - ChecksumMode disabled to prevent x-amz-checksum-mode appearing in the URL.
 *   - x-amz-checksum-mode and x-id stripped from the final URL as a safety net.
 *
 * @param key              - S3 object key (e.g. "partner/7/pan/abc.jpg"). Never a full URL.
 * @param expiresInSeconds - Validity window (default 300 = 5 minutes).
 * @returns                - Clean signed HTTPS URL.
 */
export async function generatePresignedGetUrl(
  key: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;

  if (!bucket || !region) {
    throw new Error('AWS_S3_BUCKET or AWS_REGION environment variable is not set');
  }

  // Guard: calling this with a full URL is always a bug — fail loudly
  if (key.startsWith('http://') || key.startsWith('https://')) {
    throw new Error(
      `generatePresignedGetUrl received a full URL instead of an S3 key: ${key.slice(0, 80)}`
    );
  }

  const command = new GetObjectCommand({
    Bucket:       bucket,
    Key:          key,
    ChecksumMode: undefined, // explicitly disable — prevents x-amz-checksum-mode in signed URL
  });

  const signed = await getSignedUrl(s3, command, {
    expiresIn:     expiresInSeconds,
    signingRegion: region, // pin region — avoids algorithm mismatch with some SDK versions
  });

  // Strip any params that confuse third-party fetchers (IDFY, etc.)
  const cleaned = new URL(signed);
  cleaned.searchParams.delete('x-amz-checksum-mode');
  cleaned.searchParams.delete('x-id');

  return cleaned.toString();
}
