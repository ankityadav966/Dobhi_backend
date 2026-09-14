import { PrismaClient } from '@prisma/client';

/**
 * UTC TIME SAFETY — three layers required:
 *
 * 1. process.env.TZ = 'UTC'  (set in server.ts before all imports)
 *
 * 2. DATABASE_URL must include the timezone option so every pg pool connection
 *    gets SET timezone on open. Add to your .env:
 *
 *      DATABASE_URL="postgresql://user:pass@host/db?options=-c%20timezone%3DUTC"
 *                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *    Without this, connections from new pool workers skip the SET timezone and
 *    compare timestamps in the server OS timezone, not UTC.
 *
 * 3. PostgreSQL server-level: SET timezone = 'UTC' (confirmed done).
 *
 * All three layers together give defence-in-depth for timestamptz comparisons.
 */
export const prisma = new PrismaClient();
