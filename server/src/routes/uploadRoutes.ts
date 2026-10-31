import { Router, Response } from 'express';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { UploadedAsset, User, DocumentModel, Booking, Expense, Trip } from '../models';

const router = Router();

const ALLOWED_FOLDERS = ['profiles', 'trips', 'expenses', 'bookings', 'documents', 'chat'];

export const validateFileBufferContent = (
  buffer: Buffer,
  mimetype: string,
  originalname: string
): { valid: boolean; reason?: string } => {
  if (!buffer || buffer.length === 0) {
    return { valid: false, reason: 'Uploaded file is empty.' };
  }

  // 1. Detect executable binaries (DOS/Windows PE "MZ", Linux ELF "\x7fELF", Shebang "#!")
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { valid: false, reason: 'Executable files (MZ/PE) are strictly prohibited.' };
  }
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { valid: false, reason: 'Executable binaries (ELF) are strictly prohibited.' };
  }
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    return { valid: false, reason: 'Executable script files (shebang #!) are strictly prohibited.' };
  }

  // Detect authoritative magic bytes
  let detectedType: 'jpeg' | 'png' | 'gif' | 'webp' | 'pdf' | 'zip' | 'unknown' = 'unknown';

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedType = 'jpeg';
  } else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedType = 'png';
  } else if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    detectedType = 'gif';
  } else if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detectedType = 'webp';
  } else if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    detectedType = 'pdf';
  } else if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    detectedType = 'zip';
  }

  // 2. Reject HTML / SVG / Script payloads
  let offset = 0;
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    offset = 3;
  }
  const sample = buffer.subarray(offset, Math.min(buffer.length, offset + 2048)).toString('utf-8').trimStart().toLowerCase();

  // Strict script and HTML injection checks (even for polyglots or embedded blocks)
  if (
    sample.includes('<script') ||
    sample.includes('<?php') ||
    sample.includes('<!doctype html') ||
    sample.includes('<html') ||
    sample.includes('<body') ||
    sample.includes('<iframe') ||
    sample.includes('javascript:')
  ) {
    return { valid: false, reason: 'HTML, SVG, and script payloads are strictly prohibited.' };
  }

  // SVG Detection:
  const normMime = (mimetype || '').toLowerCase();
  const lastDot = (originalname || '').lastIndexOf('.');
  const ext = lastDot !== -1 ? originalname.toLowerCase().substring(lastDot) : '';

  if (normMime === 'image/svg+xml' || ext === '.svg') {
    return { valid: false, reason: 'HTML, SVG, and script payloads are strictly prohibited.' };
  }

  // File content starts with SVG or XML declaring SVG
  if (sample.startsWith('<svg') || sample.startsWith('<!doctype svg') || sample.startsWith('<svg:')) {
    return { valid: false, reason: 'HTML, SVG, and script payloads are strictly prohibited.' };
  }
  if (sample.startsWith('<?xml')) {
    const afterXml = sample.replace(/^<\?xml[^>]*\?>\s*/, '').replace(/<!--[\s\S]*?-->\s*/g, '');
    if (afterXml.startsWith('<svg') || afterXml.startsWith('<!doctype svg') || afterXml.startsWith('<svg:')) {
      return { valid: false, reason: 'HTML, SVG, and script payloads are strictly prohibited.' };
    }
  }

  // If content is not an authentic binary image, but contains <svg anywhere in sample
  if (detectedType === 'unknown' && (sample.includes('<svg') || sample.includes('xmlns="http://www.w3.org/2000/svg"'))) {
    return { valid: false, reason: 'HTML, SVG, and script payloads are strictly prohibited.' };
  }

  // 3. For image and document mimetypes / extensions, enforce magic byte signatures and extension consistency
  if (mimetype === 'image/jpeg' || ext === '.jpg' || ext === '.jpeg') {
    if (ext && ext !== '.jpg' && ext !== '.jpeg') {
      return { valid: false, reason: 'MIME type and file extension mismatch for JPEG image.' };
    }
    if (mimetype && mimetype !== 'image/jpeg') {
      return { valid: false, reason: 'MIME type and file extension mismatch for JPEG image.' };
    }
    if (detectedType !== 'jpeg') {
      return { valid: false, reason: 'File content does not match a valid JPEG image signature.' };
    }
  } else if (mimetype === 'image/png' || ext === '.png') {
    if (ext && ext !== '.png') {
      return { valid: false, reason: 'MIME type and file extension mismatch for PNG image.' };
    }
    if (mimetype && mimetype !== 'image/png') {
      return { valid: false, reason: 'MIME type and file extension mismatch for PNG image.' };
    }
    if (detectedType !== 'png') {
      return { valid: false, reason: 'File content does not match a valid PNG image signature.' };
    }
  } else if (mimetype === 'image/gif' || ext === '.gif') {
    if (ext && ext !== '.gif') {
      return { valid: false, reason: 'MIME type and file extension mismatch for GIF image.' };
    }
    if (mimetype && mimetype !== 'image/gif') {
      return { valid: false, reason: 'MIME type and file extension mismatch for GIF image.' };
    }
    if (detectedType !== 'gif') {
      return { valid: false, reason: 'File content does not match a valid GIF image signature.' };
    }
  } else if (mimetype === 'image/webp' || ext === '.webp') {
    if (ext && ext !== '.webp') {
      return { valid: false, reason: 'MIME type and file extension mismatch for WEBP image.' };
    }
    if (mimetype && mimetype !== 'image/webp') {
      return { valid: false, reason: 'MIME type and file extension mismatch for WEBP image.' };
    }
    if (detectedType !== 'webp') {
      return { valid: false, reason: 'File content does not match a valid WEBP image signature.' };
    }
  } else if (mimetype === 'application/pdf' || ext === '.pdf') {
    if (ext && ext !== '.pdf') {
      return { valid: false, reason: 'MIME type and file extension mismatch for PDF document.' };
    }
    if (mimetype && mimetype !== 'application/pdf') {
      return { valid: false, reason: 'MIME type and file extension mismatch for PDF document.' };
    }
    if (detectedType !== 'pdf') {
      return { valid: false, reason: 'File content does not match a valid PDF document signature.' };
    }
  }

  return { valid: true };
};

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

      // Deep Content Inspection: Magic byte verification and executable/script prevention
      const contentCheck = validateFileBufferContent(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      if (!contentCheck.valid) {
        return res.status(400).json({ error: `File content validation failed: ${contentCheck.reason}` });
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

      // Track asset ownership in UploadedAsset collection
      await UploadedAsset.create({
        publicId: result.publicId,
        uploadedBy: req.user!.userId,
        folder,
        originalName: req.file.originalname,
        resourceType: result.resourceType || resourceType
      });

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

// DELETE /api/upload - Delete file from Cloudinary by publicId (Strict ownership verification)
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId, resourceType } = req.body;
    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({ error: 'publicId is required to delete an asset' });
    }

    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Authorization & Ownership Verification:
    // 1. Check direct uploader record in UploadedAsset
    const trackedAsset = await UploadedAsset.findOne({ publicId });
    if (trackedAsset) {
      if (trackedAsset.uploadedBy.toString() !== currentUserId) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to delete this asset' });
      }
    } else {
      // 2. Check referencing documents, avatars, bookings, expenses, trips
      const isAvatar = await User.exists({ _id: currentUserId, avatarPublicId: publicId });
      const isDoc = await DocumentModel.exists({ uploadedBy: currentUserId, publicId });
      const isBooking = await Booking.exists({ createdBy: currentUserId, attachmentPublicId: publicId });
      const isExpense = await Expense.exists({
        $or: [{ createdBy: currentUserId }, { paidBy: currentUserId }],
        receiptPublicId: publicId
      });
      const isTrip = await Trip.exists({ createdBy: currentUserId, coverImagePublicId: publicId });

      if (!isAvatar && !isDoc && !isBooking && !isExpense && !isTrip) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to delete this asset' });
      }
    }

    const success = await deleteFromCloudinary(publicId, resourceType || 'image');
    if (!success) {
      return res.status(400).json({ error: 'Could not delete asset from Cloudinary' });
    }

    // Clean up tracking record
    if (trackedAsset) {
      await UploadedAsset.deleteOne({ _id: trackedAsset._id });
    }

    res.json({ message: 'File deleted successfully from Cloudinary' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting file from Cloudinary' });
  }
});

export default router;
