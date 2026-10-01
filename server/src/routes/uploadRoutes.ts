import { Router, Response } from 'express';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary';

const router = Router();

const ALLOWED_FOLDERS = ['profiles', 'trips', 'expenses', 'bookings', 'documents', 'chat'];

// POST /api/upload - Upload file to Cloudinary
router.post(
  '/',
  authenticateToken,
  (req, res, next) => {
    uploadMiddleware.single('file')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB.' });
        }
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message || 'Invalid file format.' });
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const rawFolder = (req.body.folder || req.query.folder || 'documents').toString().toLowerCase();
      const folder = ALLOWED_FOLDERS.includes(rawFolder) ? rawFolder : 'documents';

      const isImage = req.file.mimetype.startsWith('image/');
      const resourceType = isImage ? 'image' : 'raw';

      const result = await uploadBufferToCloudinary(
        req.file.buffer,
        folder,
        req.file.originalname,
        resourceType
      );

      res.status(200).json({
        url: result.secureUrl || result.url,
        secureUrl: result.secureUrl,
        publicId: result.publicId,
        bytes: result.bytes,
        format: result.format,
        resourceType: result.resourceType,
        originalName: req.file.originalname,
      });
    } catch (error: any) {
      console.error('Cloudinary upload endpoint error:', error);
      res.status(500).json({ error: error.message || 'Failed to upload file to Cloudinary' });
    }
  }
);

// DELETE /api/upload - Delete file from Cloudinary by publicId
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId, resourceType } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: 'publicId is required to delete an asset' });
    }

    const success = await deleteFromCloudinary(publicId, resourceType || 'image');
    if (!success) {
      return res.status(400).json({ error: 'Could not delete asset from Cloudinary' });
    }

    res.json({ message: 'File deleted successfully from Cloudinary' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting file from Cloudinary' });
  }
});

export default router;
