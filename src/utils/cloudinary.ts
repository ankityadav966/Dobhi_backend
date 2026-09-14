/**
 * Cloudinary Storage & Upload Utility
 *
 * Provides reusable functions for uploading and deleting media on Cloudinary.
 * Credentials are read securely from environment variables.
 *
 * Environment variables:
 *   CLOUDINARY_CLOUD_NAME  - Cloudinary cloud name
 *   CLOUDINARY_API_KEY     - Cloudinary API key
 *   CLOUDINARY_API_SECRET  - Cloudinary API secret
 */

import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import logger from './logger';

// ─── Cloudinary SDK Configuration ─────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

export interface CloudinaryUploadOptions {
  folder?: string;
  publicId?: string;
  resourceType?: 'image' | 'raw' | 'auto' | 'video';
  tags?: string[];
  allowedFormats?: string[];
}

/**
 * Validates whether Cloudinary credentials are configured in environment
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Extracts public_id from a Cloudinary secure_url or regular URL.
 * Example:
 *   https://res.cloudinary.com/demo/image/upload/v1612345678/dobhi/categories/abc123.jpg
 *   -> dobhi/categories/abc123
 */
export function extractPublicIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }

  try {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    let pathPart = url.substring(uploadIndex + '/upload/'.length);

    // Strip version prefix if present (e.g. v1612345678/)
    pathPart = pathPart.replace(/^v\d+\//, '');

    // Strip extension (.jpg, .png, etc.)
    const lastDotIndex = pathPart.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      pathPart = pathPart.substring(0, lastDotIndex);
    }

    return decodeURIComponent(pathPart);
  } catch (err: any) {
    logger.warn('Failed to extract public_id from Cloudinary URL:', { url, error: err?.message });
    return null;
  }
}

/**
 * Upload a Buffer or Base64 string to Cloudinary.
 *
 * @param fileData - Raw file Buffer from multer OR base64 data URI string
 * @param options  - Folder, publicId, and upload constraints
 * @returns        - Upload metadata including secure URL and public_id
 */
export async function uploadToCloudinary(
  fileData: Buffer | string,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const folder = options.folder ? options.folder.replace(/^\/+|\/+$/g, '') : 'dobhi/uploads';
  const resourceType = options.resourceType || 'image';

  if (!isCloudinaryConfigured()) {
    logger.warn('Cloudinary credentials missing in .env — using data URI fallback');
    const mimeType = typeof fileData === 'string' && fileData.startsWith('data:') 
      ? fileData.substring(5, fileData.indexOf(';')) 
      : 'image/jpeg';
    const base64Str = typeof fileData === 'string'
      ? fileData
      : `data:${mimeType};base64,${fileData.toString('base64')}`;
    return {
      url: base64Str,
      secureUrl: base64Str,
      publicId: `fallback/${Date.now()}`,
      format: mimeType.split('/')[1] || 'jpeg',
      bytes: typeof fileData === 'string' ? fileData.length : fileData.length,
    };
  }

  // Handle Base64 string directly via uploader.upload
  if (typeof fileData === 'string') {
    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(fileData, {
        folder,
        resource_type: resourceType,
        public_id: options.publicId,
        tags: options.tags || ['dobhi'],
        allowed_formats: options.allowedFormats || ['jpg', 'png', 'jpeg', 'webp', 'svg', 'gif'],
      });

      logger.info('Cloudinary base64 upload successful', {
        publicId: result.public_id,
        bytes: result.bytes,
        secureUrl: result.secure_url,
      });

      return {
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
      };
    } catch (err: any) {
      logger.error('Cloudinary base64 upload failed:', { error: err?.message || err });
      throw new Error(`Cloudinary upload failed: ${err?.message || err}`);
    }
  }

  // Handle Buffer via upload_stream
  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: options.publicId,
        tags: options.tags || ['dobhi'],
        allowed_formats: options.allowedFormats || ['jpg', 'png', 'jpeg', 'webp', 'svg', 'gif'],
      },
      (error, result) => {
        if (error || !result) {
          logger.error('Cloudinary stream upload failed:', { error: error?.message || error });
          return reject(new Error(`Cloudinary upload failed: ${error?.message || 'Unknown error'}`));
        }

        logger.info('Cloudinary buffer upload successful', {
          publicId: result.public_id,
          bytes: result.bytes,
          secureUrl: result.secure_url,
        });

        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
        });
      }
    );

    // Pipe the buffer into the Cloudinary upload stream
    Readable.from(fileData).pipe(uploadStream);
  });
}

/**
 * Delete an image/file from Cloudinary by its public_id or full URL.
 *
 * @param publicIdOrUrl - Either a Cloudinary public_id or the full Cloudinary URL
 * @returns             - Boolean indicating whether deletion succeeded
 */
export async function deleteFromCloudinary(publicIdOrUrl: string): Promise<boolean> {
  if (!publicIdOrUrl || typeof publicIdOrUrl !== 'string') return false;

  // Do not attempt deletion on local/base64 fallbacks or external CDNs
  if (publicIdOrUrl.startsWith('data:') || (!publicIdOrUrl.includes('cloudinary.com') && publicIdOrUrl.startsWith('http'))) {
    return false;
  }

  const publicId = extractPublicIdFromUrl(publicIdOrUrl) || publicIdOrUrl;

  if (!isCloudinaryConfigured()) {
    logger.warn('Cannot delete from Cloudinary: credentials not configured', { publicId });
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    const success = result.result === 'ok' || result.result === 'not found';
    logger.info('Cloudinary destroy result:', { publicId, result: result.result, success });
    return success;
  } catch (err: any) {
    logger.warn('Failed to delete asset from Cloudinary:', { publicId, error: err?.message || err });
    return false;
  }
}

export default cloudinary;
