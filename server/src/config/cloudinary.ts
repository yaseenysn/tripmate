import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import './env';
import dotenv from 'dotenv';
import path from 'path';

let isConfigured = false;

/**
 * Validates and initializes Cloudinary configuration exactly once.
 * Ensures environment variables are loaded and required credentials exist.
 * Never logs or exposes secrets.
 */
export const ensureCloudinaryConfig = (): typeof cloudinary => {
  if (isConfigured) {
    return cloudinary;
  }

  // Fallback load in case environment was not loaded yet
  if (!process.env.CLOUDINARY_API_KEY) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
    dotenv.config();
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const missing: string[] = [];
  if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!apiKey) missing.push('CLOUDINARY_API_KEY');
  if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `Cloudinary configuration error: Missing required environment variable(s): ${missing.join(
        ', '
      )}. Please verify server environment configuration.`
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  isConfigured = true;
  return cloudinary;
};

// Attempt initial configuration if environment variables are already in process.env
try {
  ensureCloudinaryConfig();
} catch {
  // Deferred: Will be initialized when upload or delete operation is executed
}

export { cloudinary };

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
  resourceType: string;
  originalName?: string;
}

/**
 * Uploads a file buffer to Cloudinary in a specified folder.
 */
export const uploadBufferToCloudinary = (
  buffer: Buffer,
  folder: string,
  originalFilename?: string,
  resourceType: 'auto' | 'image' | 'raw' = 'auto'
): Promise<CloudinaryUploadResult> => {
  // Ensure Cloudinary SDK is initialized before creating upload stream
  ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    // Determine folder path under root tripmate directory if not prefixed
    const folderPath = folder.startsWith('tripmate/') ? folder : `tripmate/${folder}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        filename_override: originalFilename,
      },
      (error: any, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(error || new Error('Failed to upload file to Cloudinary'));
        }
        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format || '',
          bytes: result.bytes,
          resourceType: result.resource_type,
          originalName: originalFilename,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Deletes an asset from Cloudinary using its public_id.
 */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: 'image' | 'raw' | 'video' | 'auto' = 'image'
): Promise<boolean> => {
  if (!publicId) return false;
  ensureCloudinaryConfig();

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    console.error(`Error deleting asset ${publicId} from Cloudinary:`, error);
    return false;
  }
};
