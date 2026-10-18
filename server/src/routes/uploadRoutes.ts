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

  // 1. Detect executable binaries (DOS/Windows PE "MZ", Linux ELF "\x7fELF")
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { valid: false, reason: 'Executable files (MZ/PE) are strictly prohibited.' };
  }
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { valid: false, reason: 'Executable binaries (ELF) are strictly prohibited.' };
  }

  // 2. Reject HTML / Script tags masquerading as images or documents
  const headerText = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf-8').toLowerCase();
  if (
    headerText.includes('<script') ||
    headerText.includes('<?php') ||
    headerText.includes('<!doctype html') ||
    headerText.includes('<html') ||
    headerText.includes('<svg')
  ) {
    return { valid: false, reason: 'HTML, SVG, and script payloads are strictly prohibited.' };
  }

  // 3. For image mimetypes, enforce magic byte signatures
  if (mimetype === 'image/jpeg') {
    // JPEG starts with FF D8 FF
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      return { valid: false, reason: 'File content does not match a valid JPEG image signature.' };
    }
  } else if (mimetype === 'image/png') {
    // PNG starts with 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (buffer.length < 8 || !pngMagic.every((b, i) => buffer[i] === b)) {
      return { valid: false, reason: 'File content does not match a valid PNG image signature.' };
    }
  } else if (mimetype === 'image/gif') {
    // GIF starts with GIF87a or GIF89a
    const gifHeader = buffer.subarray(0, 6).toString('ascii');
    if (gifHeader !== 'GIF87a' && gifHeader !== 'GIF89a') {
      return { valid: false, reason: 'File content does not match a valid GIF image signature.' };
    }
  } else if (mimetype === 'image/webp') {
    // WEBP: "RIFF" at 0..3 and "WEBP" at 8..11
    if (
      buffer.length < 12 ||
      buffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
      buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
    ) {
      return { valid: false, reason: 'File content does not match a valid WEBP image signature.' };
    }
  } else if (mimetype === 'application/pdf') {
    // PDF starts with %PDF-
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
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
