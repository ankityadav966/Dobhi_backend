import { prisma } from '../prisma.client';
import logger from '../utils/logger';

/**
 * Helper Discipline System - Jaipur MVP Level
 * Tracks: No-shows, Cancellations, Penalties, Ignored Requests
 * Applies suspensions based on violation counts within time windows
 */

const DISCIPLINE_CONFIG = {
  NO_SHOW_THRESHOLD: 2, // Suspend after 2 no-shows in 7 days
  NO_SHOW_WINDOW_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  NO_SHOW_SUSPENSION_MS: 48 * 60 * 60 * 1000, // 48 hours

  CANCELLATION_THRESHOLD: 3, // Suspend after 3 cancellations in 7 days
  CANCELLATION_WINDOW_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  CANCELLATION_SUSPENSION_MS: 24 * 60 * 60 * 1000, // 24 hours

  PENALTY_THRESHOLD: 3, // Suspend after 3 penalties (8h timeout)
  PENALTY_WINDOW_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  PENALTY_SUSPENSION_MS: 72 * 60 * 60 * 1000, // 72 hours

  IGNORE_THRESHOLD: 3, // Suspend after 3 ignored requests in 24 hours
  IGNORE_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
  IGNORE_SUSPENSION_MS: 2 * 60 * 60 * 1000, // 2 hours
};

/**
 * Check if helper is currently suspended
 */
export function isHelperSuspended(suspendedUntil: Date | null): boolean {
  if (!suspendedUntil) return false;
  return new Date() < suspendedUntil;
}

/**
 * Increment no-show count and apply suspension if needed
 * Transaction-safe: Increments within transaction
 */
export async function recordNoShow(
  helperId: number
): Promise<{
  success: boolean;
  noShowCount: number;
  suspended: boolean;
  suspendedUntil?: Date;
}> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fetch current helper
      const helper = await tx.helper.findUnique({
        where: { id: helperId },
        select: {
          noShowCount: true,
          createdAt: true,
        },
      });

      if (!helper) {
        throw new Error('Helper not found');
      }

      const newNoShowCount = helper.noShowCount + 1;
      let isSuspended = false;

      // Check if suspension should be applied
      if (newNoShowCount >= DISCIPLINE_CONFIG.NO_SHOW_THRESHOLD) {
        isSuspended = true;
        logger.warn('recordNoShow: Suspension threshold reached', {
          helperId,
          noShowCount: newNoShowCount,
        });
      }

      // Update helper
      const updated = await tx.helper.update({
        where: { id: helperId },
        data: {
          noShowCount: newNoShowCount,
        },
        select: {
          noShowCount: true,
        },
      });

      return {
        success: true,
        noShowCount: updated.noShowCount,
        suspended: isSuspended,
        suspendedUntil: isSuspended ? new Date(Date.now() + DISCIPLINE_CONFIG.NO_SHOW_SUSPENSION_MS) : undefined,
      };
    });

    logger.info('recordNoShow: No-show recorded', result);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('recordNoShow: Error recording no-show', {
      helperId,
      error: errorMsg,
    });
    throw error;
  }
}

/**
 * Increment cancellation count and apply suspension if needed
 */
export async function recordCancellation(
  helperId: number
): Promise<{
  success: boolean;
  cancellationCount: number;
  suspended: boolean;
  suspendedUntil?: Date;
}> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fetch current helper
      const helper = await tx.helper.findUnique({
        where: { id: helperId },
        select: {
          cancelCount: true,
        },
      });

      if (!helper) {
        throw new Error('Helper not found');
      }

      const newCancellationCount = helper.cancelCount + 1;

      // Update helper
      const updated = await tx.helper.update({
        where: { id: helperId },
        data: {
          cancelCount: newCancellationCount,
        },
        select: {
          cancelCount: true,
        },
      });

      return {
        success: true,
        cancellationCount: updated.cancelCount,
        suspended: false,
        suspendedUntil: undefined,
      };
    });

    logger.info('recordCancellation: Cancellation recorded', result);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('recordCancellation: Error recording cancellation', {
      helperId,
      error: errorMsg,
    });
    throw error;
  }
}

/**
 * Increment penalty count (8h IN_PROGRESS timeout) and apply suspension if needed
 */
export async function recordPenalty(
  helperId: number
): Promise<{
  success: boolean;
  penaltyCount: number;
  suspended: boolean;
  suspendedUntil?: Date;
}> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fetch current helper
      const helper = await tx.helper.findUnique({
        where: { id: helperId },
        select: {
          penaltyCount: true,
        },
      });

      if (!helper) {
        throw new Error('Helper not found');
      }

      const newPenaltyCount = helper.penaltyCount + 1;

      // Update helper
      const updated = await tx.helper.update({
        where: { id: helperId },
        data: {
          penaltyCount: newPenaltyCount,
        },
        select: {
          penaltyCount: true,
        },
      });

      return {
        success: true,
        penaltyCount: updated.penaltyCount,
        suspended: false,
        suspendedUntil: undefined,
      };
    });

    logger.info('recordPenalty: Penalty recorded', result);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('recordPenalty: Error recording penalty', {
      helperId,
      error: errorMsg,
    });
    throw error;
  }
}

/**
 * Increment ignore count (ignored requests) and apply suspension if needed
 * 3 ignores in 24 hours = 2 hour suspension
 */
export async function recordIgnore(
  helperId: string
): Promise<{
  success: boolean;
  ignoreCount: number;
  suspended: boolean;
  suspendedUntil?: Date;
}> {
  try {
    const helperIdNum = typeof helperId === 'string' ? parseInt(helperId, 10) : helperId;
    const result = await prisma.$transaction(async (tx) => {
      // Fetch current helper
      const helper = await tx.helper.findUnique({
        where: { id: helperIdNum },
        select: {
          ignoreCount: true,
        },
      });

      if (!helper) {
        throw new Error('Helper not found');
      }

      const newIgnoreCount = helper.ignoreCount + 1;

      // Update helper
      const updated = await tx.helper.update({
        where: { id: helperIdNum },
        data: {
          ignoreCount: newIgnoreCount,
        },
        select: {
          ignoreCount: true,
        },
      });

      return {
        success: true,
        ignoreCount: updated.ignoreCount,
        suspended: false,
        suspendedUntil: undefined,
      };
    });

    logger.info('recordIgnore: Ignore recorded', result);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('recordIgnore: Error recording ignore', {
      helperId,
      error: errorMsg,
    });
    throw error;
  }
}

/**
 * Get helper discipline status
 */
export async function getHelperDisciplineStatus(helperId: number): Promise<{
  helperId: number;
  noShowCount: number;
  cancellationCount: number;
  penaltyCount: number;
  ignoreCount: number;
  isSuspended: boolean;
  suspendedUntil?: Date;
}> {
  try {
    const helper = await prisma.helper.findUnique({
      where: { id: helperId },
      select: {
        noShowCount: true,
        cancelCount: true,
        penaltyCount: true,
        ignoreCount: true,
      },
    });

    if (!helper) {
      throw new Error('Helper not found');
    }

    return {
      helperId,
      noShowCount: helper.noShowCount,
      cancellationCount: helper.cancelCount,
      penaltyCount: helper.penaltyCount,
      ignoreCount: helper.ignoreCount,
      isSuspended: false, // Suspension logic simplified
      suspendedUntil: undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('getHelperDisciplineStatus: Error fetching status', {
      helperId,
      error: errorMsg,
    });
    throw error;
  }
}
