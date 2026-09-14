import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadToS3 } from '../utils/s3';
import logger from '../utils/logger';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// POST /api/upload & /api/admin/upload
router.post('/', upload.any(), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      // Check if base64 or URL was provided in body
      const bodyImage = req.body.image || req.body.imageUrl || req.body.file;
      if (bodyImage && typeof bodyImage === 'string' && bodyImage.startsWith('data:image')) {
        const matches = bodyImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const { url, key } = await uploadToS3(buffer, mimeType, 'uploads');
          return res.json({
            success: true,
            message: 'Image uploaded to S3 successfully',
            url,
            key,
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: 'No file provided for upload',
      });
    }

    const file = files[0];
    const mimeType = file.mimetype || 'image/jpeg';
    const { url, key } = await uploadToS3(file.buffer, mimeType, 'uploads');

    logger.info(`File uploaded to S3 bucket ${process.env.AWS_S3_BUCKET}: ${url}`);

    return res.status(201).json({
      success: true,
      message: 'File uploaded to S3 bucket successfully',
      url,
      key,
      file: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url,
        key,
      }
    });
  } catch (error: any) {
    logger.error('Error in S3 upload route:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file to S3',
    });
  }
});

export default router;
