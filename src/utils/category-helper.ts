import { Request } from 'express';
import { prisma } from '../prisma.client';

export interface ResolvedCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

/**
 * Resolves category parameter from request query (?category_id=... OR ?category=... OR ?categoryId=...)
 * Returns null if 'all', empty, or not found.
 */
export async function resolveCategoryFilter(req: Request): Promise<ResolvedCategory | null> {
  const rawParam = String(
    req.query.category_id || req.query.category || req.query.categoryId || ''
  ).trim();

  if (!rawParam || rawParam.toLowerCase() === 'all' || rawParam === 'null' || rawParam === 'undefined') {
    return null;
  }

  const numId = parseInt(rawParam, 10);
  const cat = await prisma.platformCategory.findFirst({
    where: {
      OR: [
        ...(!isNaN(numId) ? [{ id: numId }] : []),
        { slug: rawParam.toLowerCase() },
        { name: { equals: rawParam, mode: 'insensitive' } },
      ],
    },
  });

  return cat ? {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    icon: cat.icon,
  } : null;
}
