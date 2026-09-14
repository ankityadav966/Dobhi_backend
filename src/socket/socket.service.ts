/**
 * socket.service.ts
 *
 * Singleton Socket.io server.
 *
 * Authentication flow:
 *   Client sends:  { auth: { token: "<Bearer token>" } }
 *   Server verifies JWT → resolves Helper.id → joins room "helper:<id>"
 *
 * Room convention:  "helper:<helperId>"   (helperId = Helper.id, integer)
 *
 * Emitted events  (server → client helper):
 *   booking:new            — new incoming booking request dispatched to this helper
 *   booking:closed         — a pending request was accepted by another helper
 *   booking:alreadyAccepted — this helper tried to accept but lost the race
 *   booking:expired        — a pending request expired without anyone accepting
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';

// ─── Singleton ─────────────────────────────────────────────────────────────────

let io: SocketServer | null = null;

// ─── Init ──────────────────────────────────────────────────────────────────────

export function initializeSocket(httpServer: HttpServer): SocketServer {
  if (io) return io; // already initialised (hot-reload guard)

  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Keep connection alive — helpers may be idle for long periods
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  // ─── Auth handshake ──────────────────────────────────────────────────────────

  io.use(async (socket: Socket, next) => {
    try {
      const raw = socket.handshake.auth?.token as string | undefined;
      if (!raw) {
        return next(new Error('AUTH_MISSING'));
      }

      const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
      const decoded = verifyAccessToken(token);
      if (!decoded) {
        return next(new Error('AUTH_INVALID'));
      }

      // Resolve Helper row from User id
      const userId = parseInt(decoded.userId, 10);
      const helper = await prisma.helper.findUnique({
        where: { userId },
        select: { id: true, isOnline: true },
      });

      if (!helper) {
        return next(new Error('HELPER_NOT_FOUND'));
      }

      // Attach helper info to socket for later use
      (socket as any).helperId = helper.id;
      (socket as any).userId = userId;
      next();
    } catch (err) {
      logger.error('Socket auth error:', err);
      next(new Error('AUTH_ERROR'));
    }
  });

  // ─── Connection ──────────────────────────────────────────────────────────────

  io.on('connection', (socket: Socket) => {
    const helperId: number = (socket as any).helperId;

    // Each helper joins their private room
    const room = helperRoom(helperId);
    socket.join(room);

    logger.info('Helper connected via socket', { helperId, socketId: socket.id });

    socket.on('disconnect', (reason) => {
      logger.info('Helper disconnected', { helperId, socketId: socket.id, reason });
    });

    // Helper can emit "ping" to verify connection; server echoes back
    socket.on('ping', () => {
      socket.emit('pong', { ts: Date.now() });
    });
  });

  logger.info('Socket.io server initialised');
  return io;
}

// ─── Accessors ─────────────────────────────────────────────────────────────────

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialised — call initializeSocket first');
  return io;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Room name for a given helper */
export function helperRoom(helperId: number): string {
  return `helper:${helperId}`;
}

/**
 * Emit an event to a specific helper's room.
 * Safe to call even before Socket.io is initialised (no-op in that case).
 */
export function emitToHelper(helperId: number, event: string, data: unknown): void {
  if (!io) {
    logger.debug('Socket.io not ready — skipping emit', { helperId, event });
    return;
  }
  io.to(helperRoom(helperId)).emit(event, data);
}

/**
 * Emit an event to multiple helpers at once.
 * Excludes `excludeHelperId` when provided (used for booking:closed).
 */
export function emitToHelpers(
  helperIds: number[],
  event: string,
  data: unknown,
  excludeHelperId?: number
): void {
  if (!io) {
    logger.debug('Socket.io not ready — skipping broadcast', { event });
    return;
  }
  for (const hId of helperIds) {
    if (excludeHelperId !== undefined && hId === excludeHelperId) continue;
    io.to(helperRoom(hId)).emit(event, data);
  }
}

/** Room name for a given customer (by userId) */
export function customerRoom(userId: number): string {
  return `customer:${userId}`;
}

/**
 * Emit an event to a specific customer's room.
 * Safe to call even before Socket.io is initialised (no-op in that case).
 */
export function emitToCustomer(userId: number, event: string, data: unknown): void {
  if (!io) {
    logger.debug('Socket.io not ready — skipping emit', { userId, event });
    return;
  }
  io.to(customerRoom(userId)).emit(event, data);
}

/**
 * Broadcast event to all connected clients / web sellers
 */
export function broadcastSellerEvent(event: string, data: unknown): void {
  if (!io) {
    logger.debug('Socket.io not ready — skipping broadcast', { event });
    return;
  }
  io.emit(event, data);
}
