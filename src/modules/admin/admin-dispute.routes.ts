import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import { resolveCategoryFilter } from '../../utils/category-helper';
import logger from '../../utils/logger';

const router = Router();

// GET /api/admin/disputes?category_id=...
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const cat = await resolveCategoryFilter(req);

    const disputes: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Dispute" ORDER BY "createdAt" DESC`
    );

    let mapped = disputes.map(d => ({
      id: d.ticketId,
      dbId: d.id,
      orderId: d.orderId || 'HB001',
      type: d.type,
      reportedBy: d.reportedBy,
      against: d.against,
      issue: d.issue,
      description: d.description,
      date: new Date(d.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: d.status,
      priority: d.priority,
      resolution: d.resolution,
      hasProof: Boolean(d.hasProof),
      categoryId: d.categoryId,
    }));

    if (cat) {
      mapped = mapped.filter((d) => {
        if (d.categoryId === cat.id) return true;
        const oid = (d.orderId || '').toUpperCase();
        const issue = (d.issue || '').toLowerCase();
        const desc = (d.description || '').toLowerCase();
        if (cat.slug === 'laundry' && (oid.includes('LND') || issue.includes('laundry') || desc.includes('laundry') || desc.includes('pickup'))) return true;
        if (cat.slug === 'grocery' && (oid.includes('GRC') || issue.includes('grocery') || desc.includes('grocery') || desc.includes('item'))) return true;
        if (cat.slug === 'home-services' && (oid.startsWith('HB') || issue.includes('cooking') || issue.includes('cleaning') || desc.includes('helper'))) return true;
        return false;
      });
    }

    return res.json({
      success: true,
      disputes: mapped,
      data: mapped,
      total: mapped.length,
      categoryFilter: cat?.name || 'All Categories',
    });
  } catch (error: any) {
    logger.error('Error fetching disputes:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch disputes' });
  }
});

// PATCH /api/admin/disputes/:id/resolve
router.patch('/:id/resolve', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    const numericId = parseInt(id, 10);
    const existing: any[] = !isNaN(numericId)
      ? await prisma.$queryRawUnsafe(`SELECT * FROM "Dispute" WHERE "id" = $1 LIMIT 1`, numericId)
      : await prisma.$queryRawUnsafe(`SELECT * FROM "Dispute" WHERE "ticketId" = $1 LIMIT 1`, id);

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    const dispute = existing[0];
    const newStatus = status || 'resolved';
    const newResolution = resolution || dispute.resolution || 'Resolved by admin';

    const updated: any[] = await prisma.$queryRawUnsafe(
      `UPDATE "Dispute" SET "status" = $1, "resolution" = $2, "updatedAt" = NOW() WHERE "id" = $3 RETURNING *`,
      newStatus, newResolution, dispute.id
    );

    return res.json({ success: true, message: 'Dispute resolved successfully', dispute: updated[0] });
  } catch (error: any) {
    logger.error('Error resolving dispute:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to resolve dispute' });
  }
});

// POST /api/admin/disputes (Support ticket creation)
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { orderId, type, reportedBy, against, issue, description, priority, categoryId } = req.body;

    const countRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "Dispute"`);
    const count = (countRes[0]?.count || 0) + 1;
    const ticketId = `DIS${String(count).padStart(3, '0')}`;

    const created: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO "Dispute" ("ticketId", "orderId", "type", "reportedBy", "against", "issue", "description", "priority", "status", "hasProof", "categoryId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', false, $9, NOW(), NOW()) RETURNING *`,
      ticketId, orderId || 'GENERAL', type || 'customer', reportedBy || 'Admin', against || 'Store', issue || 'General Support', description || '', priority || 'medium', categoryId || null
    );

    return res.status(201).json({ success: true, message: 'Dispute created', dispute: created[0] });
  } catch (error: any) {
    logger.error('Error creating dispute:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create dispute' });
  }
});

export default router;
