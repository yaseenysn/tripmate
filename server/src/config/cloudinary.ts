import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary SDK with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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
