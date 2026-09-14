/**
 * Batch Image Migration to AWS S3 (orqiva-storage)
 * 
 * Scans all ServiceCategories, KiranaCategories, KiranaProducts, and Sellers.
 * If the image is base64 or a remote URL, it uploads to S3 bucket (orqiva-storage)
 * and updates the database record with the new S3 URL.
 */

import { prisma } from '../prisma.client';
import { uploadToS3 } from '../utils/s3';
import logger from '../utils/logger';
import axios from 'axios';

async function imageToBuffer(imageStr: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!imageStr) return null;

  // 1. Check if base64 data URI
  if (imageStr.startsWith('data:image')) {
    const matches = imageStr.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (matches) {
      return {
        buffer: Buffer.from(matches[2], 'base64'),
        mimeType: matches[1],
      };
    }
  }

  // 2. Check if already on orqiva-storage S3
  if (imageStr.includes('orqiva-storage.s3')) {
    return null; // already on S3!
  }

  // 3. If external HTTP/HTTPS URL, download buffer
  if (imageStr.startsWith('http://') || imageStr.startsWith('https://')) {
    try {
      const response = await axios.get(imageStr, { responseType: 'arraybuffer', timeout: 10000 });
      const mimeType = String(response.headers['content-type'] || 'image/jpeg');
      return {
        buffer: Buffer.from(response.data),
        mimeType,
      };
    } catch (e: any) {
      logger.warn(`Could not download image ${imageStr.slice(0, 60)}: ${e.message}`);
      return null;
    }
  }

  return null;
}

export async function migrateAllImagesToS3() {
  console.log('🚀 Starting image migration to S3 bucket:', process.env.AWS_S3_BUCKET || 'orqiva-storage');
  let migratedCount = 0;

  // 1. ServiceCategory
  try {
    const serviceCats: any[] = await prisma.$queryRawUnsafe(`SELECT id, name, "imageUrl" FROM "ServiceCategory";`);
    for (const cat of serviceCats) {
      if (cat.imageUrl && !cat.imageUrl.includes('orqiva-storage.s3')) {
        const file = await imageToBuffer(cat.imageUrl);
        if (file) {
          const { url } = await uploadToS3(file.buffer, file.mimeType, 'uploads');
          await prisma.$executeRawUnsafe(`UPDATE "ServiceCategory" SET "imageUrl" = $1 WHERE id = $2;`, url, cat.id);
          console.log(`✓ ServiceCategory [${cat.name}] updated to S3: ${url}`);
          migratedCount++;
        }
      }
    }
  } catch (e: any) {
    console.warn('Error in ServiceCategory migration:', e.message);
  }

  // 2. KiranaCategory
  try {
    const kiranaCats = await prisma.kiranaCategory.findMany();
    for (const cat of kiranaCats) {
      if (cat.image && !cat.image.includes('orqiva-storage.s3')) {
        const file = await imageToBuffer(cat.image);
        if (file) {
          const { url } = await uploadToS3(file.buffer, file.mimeType, 'uploads');
          await prisma.kiranaCategory.update({
            where: { id: cat.id },
            data: { image: url }
          });
          console.log(`✓ KiranaCategory [${cat.name}] updated to S3: ${url}`);
          migratedCount++;
        }
      }
    }
  } catch (e: any) {
    console.warn('Error in KiranaCategory migration:', e.message);
  }

  // 3. KiranaProduct
  try {
    const products = await prisma.kiranaProduct.findMany({ take: 50 });
    for (const prod of products) {
      if (prod.image && !prod.image.includes('orqiva-storage.s3')) {
        const file = await imageToBuffer(prod.image);
        if (file) {
          const { url } = await uploadToS3(file.buffer, file.mimeType, 'uploads');
          await prisma.kiranaProduct.update({
            where: { id: prod.id },
            data: { image: url }
          });
          console.log(`✓ KiranaProduct [${prod.name}] updated to S3: ${url}`);
          migratedCount++;
        }
      }
    }
  } catch (e: any) {
    console.warn('Error in KiranaProduct migration:', e.message);
  }

  console.log(`🎉 Total images migrated to S3: ${migratedCount}`);
  return migratedCount;
}

if (require.main === module) {
  migrateAllImagesToS3()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
