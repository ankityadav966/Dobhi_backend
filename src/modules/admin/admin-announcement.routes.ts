import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import { sendAnnouncementEmail } from '../../services/email.service';
import logger from '../../utils/logger';

const router = Router();

/**
 * GET /api/admin/announcements
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const announcements = await prisma.platformAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    return res.json({
      success: true,
      data: announcements,
      total: announcements.length,
    });
  } catch (error: any) {
    logger.error('Error fetching announcements:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch announcements' });
  }
});

/**
 * POST /api/admin/announcements
 * Broadcasts an announcement to target user groups
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, targetUsers = 'ALL_SELLERS', categoryId, sendEmail = true } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required for an announcement.',
      });
    }

    const cleanTitle = String(title).trim();
    const cleanDesc = String(description).trim();
    const cleanTarget = String(targetUsers).toUpperCase();

    const announcement = await prisma.platformAnnouncement.create({
      data: {
        title: cleanTitle,
        description: cleanDesc,
        targetUsers: cleanTarget,
        categoryId: categoryId ? parseInt(String(categoryId), 10) : null,
        emailSent: Boolean(sendEmail),
      }
    });

    // Send email broadcasts asynchronously if enabled
    let sentCount = 0;
    if (sendEmail) {
      sentCount = await sendAnnouncementEmail(cleanTitle, cleanDesc, cleanTarget);
    }

    logger.info(`[Announcement Created] "${cleanTitle}" targeted to ${cleanTarget}. Emails dispatched: ${sentCount}`);

    return res.status(201).json({
      success: true,
      message: `Announcement created and dispatched to ${sentCount} recipient(s).`,
      data: announcement,
      emailsSent: sentCount,
    });
  } catch (error: any) {
    logger.error('Error creating announcement:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create announcement' });
  }
});

export default router;
