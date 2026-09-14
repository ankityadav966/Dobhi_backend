/**
 * Multer upload middleware — memory storage only.
 *
 * Files are held in memory (req.file.buffer) so they can be streamed
 * directly to S3 without touching the filesystem.
 *
 * Constraints:
 *   - Max file size : 5 MB
 *   - `upload`          — JPEG, PNG, PDF  (police/general documents)
 *   - `uploadImageOnly` — JPEG, PNG only  (selfie, PAN card)
 */

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
]);

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
  }
};

const imageOnlyFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG and PNG images are allowed'));
  }
};

/**
 * Accepts JPEG, PNG, and PDF — for documents such as police verification.
 * Usage: `upload.single('file')` in a route.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
});

/**
 * Accepts JPEG and PNG only — for photos such as selfie and PAN card.
 * Usage: `uploadImageOnly.single('file')` in a route.
 */
export const uploadImageOnly = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: imageOnlyFilter,
});
