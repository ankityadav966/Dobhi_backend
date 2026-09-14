import 'dotenv/config';
process.env.TZ = 'UTC';

import { createServer } from 'http';
import { createApp } from './app';
import { config } from './config/index';
import logger from './utils/logger';
import { PrismaClient } from '@prisma/client';
import { initializeCronJobs, stopCronJobs } from './tasks/expiry-cronjob';
import { initializeSocket } from './socket/socket.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── S3 startup diagnostics ───────────────────────────────────────────────────
// Runs once at boot. Remove or gate behind NODE_ENV !== 'production' when done.
async function diagnoseS3(): Promise<void> {
  // 1. Region
  const region = process.env.AWS_REGION;
  console.log('[S3-DIAG] AWS_REGION         :', region ?? '⚠  NOT SET');

  // 2. Credentials (key ID only — never log the secret)
  const keyId  = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  console.log('[S3-DIAG] AWS_ACCESS_KEY_ID  :', keyId  ? `${keyId.slice(0, 4)}****` : '⚠  NOT SET');
  console.log('[S3-DIAG] AWS_SECRET_ACCESS  :', secret ? 'set (hidden)'              : '⚠  NOT SET');

  // 3. System clock (drift > ±5 min causes signing failures)
  const now = new Date();
  console.log('[S3-DIAG] System UTC time    :', now.toISOString());
  console.log('[S3-DIAG] Unix timestamp     :', Math.floor(now.getTime() / 1000));

  // 4. AWS SDK package versions
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const s3pkg       = require('@aws-sdk/client-s3/package.json')       as { version: string };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const presignPkg  = require('@aws-sdk/s3-request-presigner/package.json') as { version: string };
    console.log('[S3-DIAG] @aws-sdk/client-s3               :', s3pkg.version);
    console.log('[S3-DIAG] @aws-sdk/s3-request-presigner    :', presignPkg.version);
    if (s3pkg.version !== presignPkg.version) {
      console.warn('[S3-DIAG] ⚠  VERSION MISMATCH — both packages must be the same version');
    }
  } catch {
    console.warn('[S3-DIAG] Could not read AWS SDK package versions');
  }

  // 5. Live credential resolution + test pre-signed URL generation
  try {
    const client = new S3Client({ region: region ?? 'ap-south-1' });
    // Resolve credentials the SDK will actually use
    const creds  = await client.config.credentials();
    console.log('[S3-DIAG] Resolved key ID    :', creds.accessKeyId.slice(0, 4) + '****');
    console.log('[S3-DIAG] Has session token  :', !!creds.sessionToken);

    const bucket = process.env.AWS_S3_BUCKET;
    if (bucket) {
      const cmd     = new GetObjectCommand({ Bucket: bucket, Key: 'diagnostic-probe' });
      const signed  = await getSignedUrl(client, cmd, { expiresIn: 60 });
      const algo    = new URL(signed).searchParams.get('X-Amz-Algorithm');
      console.log('[S3-DIAG] X-Amz-Algorithm    :', algo ?? '⚠  missing');
      console.log('[S3-DIAG] Pre-sign succeeded  : true');
    } else {
      console.warn('[S3-DIAG] AWS_S3_BUCKET not set — skipping pre-sign test');
    }
  } catch (err) {
    console.error('[S3-DIAG] ⚠  Credential/pre-sign error:', (err as Error).message);
  }
}

const prisma = new PrismaClient();

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // S3 / credential diagnostics — check console output on startup
    await diagnoseS3();

    // Initialize background cron jobs
    initializeCronJobs();
    logger.info('Background jobs initialized');

    const app = createApp();

    // Wrap Express app in a raw HTTP server so Socket.io can attach
    const httpServer = createServer(app);

    // Attach Socket.io — must happen before httpServer.listen
    initializeSocket(httpServer);

    httpServer.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info('Socket.io attached to HTTP server');
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully...`);
      stopCronJobs();
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
