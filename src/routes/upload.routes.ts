import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '../utils/cloudinary';
import logger from '../utils/logger';

const router = Router();

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WEBP, GIF, and SVG images are allowed.`));
    }
  },
});

/**
 * Determine folder for Cloudinary based on request context.
 * Maps entity types to structured folders: dobhi/users, dobhi/products, dobhi/services, dobhi/vendors, dobhi/categories
 */
function resolveUploadFolder(req: Request): string {
  const entity = (req.body.entity || req.query.entity || req.body.folder || req.query.folder || 'uploads').toString().toLowerCase();
  
  if (entity.startsWith('dobhi/')) {
    return entity;
  }

  switch (entity) {
    case 'user':
    case 'users':
    case 'profile':
      return 'dobhi/users';
    case 'product':
    case 'products':
    case 'kirana':
      return 'dobhi/products';
    case 'service':
    case 'services':
      return 'dobhi/services';
    case 'vendor':
    case 'vendors':
    case 'seller':
    case 'sellers':
      return 'dobhi/vendors';
    case 'category':
    case 'categories':
      return 'dobhi/categories';
    case 'kyc':
      return 'dobhi/kyc';
    case 'work-photos':
      return 'dobhi/work-photos';
    default:
      return `dobhi/${entity}`;
  }
}

// POST /api/upload & /api/admin/upload
router.post('/', (req: Request, res: Response, next) => {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum allowed file size is 10MB.',
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const targetFolder = resolveUploadFolder(req);
    const oldImage = req.body.oldImageUrl || req.body.oldPublicId;

    // Optional deletion of old image if client passes oldImageUrl / oldPublicId
    if (oldImage) {
      deleteFromCloudinary(oldImage).catch((delErr) => {
        logger.warn('Failed to delete old image during replacement:', { oldImage, error: delErr?.message });
      });
    }

    const files = req.files as Express.Multer.File[];
    
    // Check for base64 string if no multipart files provided
    if (!files || files.length === 0) {
      const bodyImage = req.body.image || req.body.imageUrl || req.body.file;
      if (bodyImage && typeof bodyImage === 'string' && bodyImage.startsWith('data:image')) {
        const matches = bodyImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            return res.status(400).json({
              success: false,
              message: `Invalid base64 image type: ${mimeType}. Only images are allowed.`,
            });
          }

          const uploadResult = await uploadToCloudinary(bodyImage, { folder: targetFolder });
          
          return res.status(201).json({
            success: true,
            message: 'Image uploaded successfully',
            url: uploadResult.secureUrl,
            public_id: uploadResult.publicId,
            key: uploadResult.publicId,
            data: {
              image_url: uploadResult.secureUrl,
              public_id: uploadResult.publicId,
              format: uploadResult.format,
              bytes: uploadResult.bytes,
            },
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: 'No file provided for upload. Provide multipart form-data or base64 data URI.',
      });
    }

    const file = files[0];
    const uploadResult = await uploadToCloudinary(file.buffer, {
      folder: targetFolder,
    });

    logger.info(`File uploaded to Cloudinary: ${uploadResult.secureUrl}`);

    return res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      url: uploadResult.secureUrl,
      public_id: uploadResult.publicId,
      key: uploadResult.publicId,
      data: {
        image_url: uploadResult.secureUrl,
        public_id: uploadResult.publicId,
        originalname: file.originalname,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        width: uploadResult.width,
        height: uploadResult.height,
      },
      file: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: uploadResult.secureUrl,
        public_id: uploadResult.publicId,
        key: uploadResult.publicId,
      },
    });
  } catch (error: any) {
    logger.error('Error in Cloudinary upload route:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file to Cloudinary',
    });
  }
});

// DELETE /api/upload - Delete an image by public_id or full URL
router.delete('/', async (req: Request, res: Response) => {
  try {
    const target = req.body.public_id || req.body.publicId || req.body.url || req.query.public_id || req.query.url;
    if (!target) {
      return res.status(400).json({
        success: false,
        message: 'public_id or url is required for deletion',
      });
    }

    const deleted = await deleteFromCloudinary(String(target));
    return res.json({
      success: deleted,
      message: deleted ? 'Image deleted successfully from Cloudinary' : 'Image not found or could not be deleted',
      public_id: extractPublicIdFromUrl(String(target)) || target,
    });
  } catch (err: any) {
    logger.error('Error deleting image from Cloudinary:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete image from Cloudinary',
    });
  }
});

export default router;
