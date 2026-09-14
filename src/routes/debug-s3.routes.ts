/**
 * debug-s3.routes.ts  —  DEVELOPMENT ONLY
 *
 * Mounted at GET /debug-s3 when NODE_ENV !== 'production'.
 * Use this to verify presigned URL generation end-to-end.
 *
 * Usage:
 *   GET /debug-s3                          — uses built-in probe key
 *   GET /debug-s3?key=partner/7/pan/x.jpg  — test any real object key
 *
 * Verification checklist printed to console on every request.
 */

import { Router, Request, Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<any> => {
  // ── 1. Runtime env check ────────────────────────────────────────────────────
  const region    = process.env.AWS_REGION;
  const bucket    = process.env.AWS_S3_BUCKET;
  const keyId     = process.env.AWS_ACCESS_KEY_ID;
  const secret    = process.env.AWS_SECRET_ACCESS_KEY;

  console.log('\n══════════════ S3 DEBUG ══════════════');
  console.log('[1] AWS_REGION       :', region  ?? '⚠  NOT SET');
  console.log('[1] AWS_S3_BUCKET    :', bucket  ?? '⚠  NOT SET');
  console.log('[1] ACCESS_KEY_ID    :', keyId   ? `${keyId.slice(0, 4)}****` : '⚠  NOT SET');
  console.log('[1] SECRET_ACCESS    :', secret  ? 'set (hidden)' : '⚠  NOT SET');

  if (!region || !bucket || !keyId || !secret) {
    return res.status(500).json({
      ok:    false,
      error: 'One or more AWS env vars are missing — check console',
    });
  }

  // ── 2. Key format check ─────────────────────────────────────────────────────
  // Accept ?key= from the query string, fall back to a safe probe key.
  const rawKey = typeof req.query.key === 'string' ? req.query.key : 'debug-probe/test.txt';

  // Guard: key must never be a full URL
  const isFullUrl = rawKey.startsWith('http://') || rawKey.startsWith('https://');
  console.log('[2] Raw key          :', rawKey);
  console.log('[2] Key is full URL  :', isFullUrl, isFullUrl ? '⚠  WRONG — pass only the S3 key path' : '✓');

  const key = isFullUrl
    ? new URL(rawKey).pathname.replace(/^\//, '')   // strip leading slash
    : rawKey;

  console.log('[2] Key used         :', key);

  // ── 3. Credential resolution + presign ──────────────────────────────────────
  let signedUrl: string;
  let resolvedKeyId: string;
  let hasSessionToken: boolean;

  try {
    const client   = new S3Client({ region });
    const creds    = await client.config.credentials();
    resolvedKeyId  = creds.accessKeyId;
    hasSessionToken = !!creds.sessionToken;

    console.log('[3] Resolved key ID  :', `${resolvedKeyId.slice(0, 4)}****`);
    console.log('[3] Has session token:', hasSessionToken);
    console.log('[3] Env key matches  :', resolvedKeyId === keyId ? '✓' : '⚠  MISMATCH');

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    signedUrl     = await getSignedUrl(client, command, { expiresIn: 300 });

    const parsed  = new URL(signedUrl);
    const algo    = parsed.searchParams.get('X-Amz-Algorithm');
    const expires = parsed.searchParams.get('X-Amz-Expires');
    console.log('[3] X-Amz-Algorithm  :', algo    ?? '⚠  missing');
    console.log('[3] X-Amz-Expires    :', expires ?? '⚠  missing');
    console.log('[3] Pre-sign result  : ✓ success');
  } catch (err) {
    console.error('[3] ⚠  Pre-sign failed:', (err as Error).message);
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }

  // ── 4. SDK version check ────────────────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const s3v    = (require('@aws-sdk/client-s3/package.json')              as { version: string }).version;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const presv  = (require('@aws-sdk/s3-request-presigner/package.json')   as { version: string }).version;
    console.log('[4] client-s3 version            :', s3v);
    console.log('[4] s3-request-presigner version  :', presv);
    if (s3v !== presv) {
      console.warn('[4] ⚠  VERSION MISMATCH — run: npm install @aws-sdk/client-s3@' + s3v + ' @aws-sdk/s3-request-presigner@' + s3v);
    } else {
      console.log('[4] Versions match ✓');
    }
  } catch {
    console.warn('[4] Could not read SDK package versions');
  }

  console.log('══════════════════════════════════════\n');

  return res.json({
    ok:          true,
    region,
    bucket,
    keyUsed:     key,
    keyWasUrl:   isFullUrl,
    signedUrl,
    instructions: [
      '1. Open signedUrl in your browser — the object must already exist in S3 or you will get NoSuchKey (not an auth error)',
      '2. If you still get AuthorizationQueryParametersError, check [4] version mismatch in the console',
      '3. Pass ?key=partner/7/pan/abc.jpg to test a real uploaded object key',
    ],
  });
});

export default router;
