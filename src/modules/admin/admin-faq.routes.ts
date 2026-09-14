import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import { resolveCategoryFilter } from '../../utils/category-helper';
import logger from '../../utils/logger';

const router = Router();

// GET /api/admin/faqs?category_id=...&search=...
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const cat = await resolveCategoryFilter(req);
    const search = String(req.query.search || '').trim().toLowerCase();

    const where: any = {};
    if (cat) {
      where.OR = [
        { categoryId: cat.id },
        { category: { contains: cat.slug, mode: 'insensitive' } },
        { category: { contains: cat.name, mode: 'insensitive' } },
      ];
    }

    if (search) {
      const searchCondition = {
        OR: [
          { question: { contains: search, mode: 'insensitive' } },
          { answer: { contains: search, mode: 'insensitive' } },
        ],
      };
      if (where.OR) {
        where.AND = [searchCondition];
      } else {
        where.OR = searchCondition.OR;
      }
    }

    const faqs = await prisma.fAQ.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json({
      success: true,
      data: faqs,
      faqs,
      total: faqs.length,
      categoryFilter: cat?.name || 'All Categories',
    });
  } catch (error: any) {
    logger.error('Error fetching FAQs:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch FAQs' });
  }
});

// POST /api/admin/faqs
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { question, answer, categoryId, category, isActive = true, sortOrder = 0 } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ success: false, message: 'Question and answer are required' });
    }

    let resolvedCatId = categoryId ? parseInt(String(categoryId), 10) : null;
    let resolvedCatSlug = category || null;

    if (!resolvedCatId && resolvedCatSlug) {
      const pCat = await prisma.platformCategory.findFirst({
        where: {
          OR: [
            { slug: String(resolvedCatSlug).toLowerCase() },
            { name: { equals: String(resolvedCatSlug), mode: 'insensitive' } },
          ],
        },
      });
      if (pCat) {
        resolvedCatId = pCat.id;
        resolvedCatSlug = pCat.slug;
      }
    }

    const faq = await prisma.fAQ.create({
      data: {
        question: String(question).trim(),
        answer: String(answer).trim(),
        categoryId: isNaN(resolvedCatId as number) ? null : resolvedCatId,
        category: resolvedCatSlug,
        isActive: Boolean(isActive),
        sortOrder: Number(sortOrder) || 0,
      },
    });

    return res.status(201).json({ success: true, message: 'FAQ created successfully', data: faq });
  } catch (error: any) {
    logger.error('Error creating FAQ:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create FAQ' });
  }
});

// PUT /api/admin/faqs/:id
router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid FAQ ID' });

    const { question, answer, categoryId, category, isActive, sortOrder } = req.body;

    const data: any = {};
    if (question !== undefined) data.question = String(question).trim();
    if (answer !== undefined) data.answer = String(answer).trim();
    if (categoryId !== undefined) data.categoryId = categoryId ? parseInt(String(categoryId), 10) : null;
    if (category !== undefined) data.category = category;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder) || 0;

    const updated = await prisma.fAQ.update({
      where: { id },
      data,
    });

    return res.json({ success: true, message: 'FAQ updated successfully', data: updated });
  } catch (error: any) {
    logger.error('Error updating FAQ:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update FAQ' });
  }
});

// DELETE /api/admin/faqs/:id
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid FAQ ID' });

    await prisma.fAQ.delete({ where: { id } });
    return res.json({ success: true, message: 'FAQ deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting FAQ:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete FAQ' });
  }
});

export default router;
