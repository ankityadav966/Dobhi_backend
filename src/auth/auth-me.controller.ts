import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';

export async function getMeHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userIdNum = parseInt(userId, 10);

    const user = await prisma.user.findUnique({
      where: { id: userIdNum },
      select: {
        id: true,
        fullName: true,
        phone: true,
        avatar: true,
        role: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName || '',
        phone: user.phone || null,
        avatar: user.avatar || null,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Error fetching user info:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user info' });
  }
}
