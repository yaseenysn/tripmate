import { Router, Response } from 'express';
import { DocumentModel, UploadedAsset } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireNotClosedTrip, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';
import { deleteFromCloudinary } from '../config/cloudinary';
import { isValidObjectId, isValidUrl, isSafeString, handleRouteError } from '../utils/validation';
import { verifyAssetOwnership } from '../utils/assetSecurity';

const ALLOWED_DOC_TYPES = ['TICKET', 'RECEIPT', 'CONFIRMATION', 'ID', 'PHOTO', 'OTHER'];

const router = Router();

// GET /api/trips/:id/documents
router.get('/:id/documents', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const documents = await DocumentModel.find({ tripId }).populate('uploadedBy', 'name avatar').sort({ createdAt: -1 });
    res.json({ documents });
  } catch (error: any) {
    handleRouteError(error, res, 'Error fetching documents');
  }
});

// POST /api/trips/:id/documents
router.post('/:id/documents', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { name, type, fileUrl, publicId, fileSize } = req.body;

    if (!name || !fileUrl) {
      return res.status(400).json({ error: 'Name and file URL are required' });
    }

    if (!isSafeString(name, 1, 150)) {
      return res.status(400).json({ error: 'Document name must be between 1 and 150 characters' });
    }

    if (!isValidUrl(fileUrl)) {
      return res.status(400).json({ error: 'Invalid file URL protocol. Only HTTP and HTTPS are permitted.' });
    }

    if (type && !ALLOWED_DOC_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid document type. Must be one of: ${ALLOWED_DOC_TYPES.join(', ')}` });
    }

    if (publicId) {
      if (typeof publicId !== 'string' || publicId.length > 200) {
        return res.status(400).json({ error: 'Invalid publicId format' });
      }
      const isOwner = await verifyAssetOwnership(publicId, userId);
      if (!isOwner) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to attach this asset.' });
      }
    }

    const doc = await DocumentModel.create({
      tripId,
      name,
      type: type || 'OTHER',
      fileUrl,
      publicId: publicId || undefined,
      fileSize: fileSize || '1.2 MB',
      uploadedBy: userId
    });

    const populated = await DocumentModel.findById(doc._id).populate('uploadedBy', 'name avatar');

    const isImage = type === 'PHOTO' || /\.(jpe?g|png|webp|gif|svg)$/i.test(name) || /\/image\/upload\//.test(fileUrl);
    const actType = isImage ? 'PHOTO_UPLOADED' : 'DOCUMENT_UPLOADED';
    const label = isImage ? 'photo' : 'document';
    await logActivity(tripId, userId, actType, `uploaded ${label} "${name}"`, {
      documentId: doc._id,
      document: populated
    });
    emitToTrip(tripId, 'document.created', populated);

    res.status(201).json({ document: populated });
  } catch (error: any) {
    handleRouteError(error, res, 'Error uploading document');
  }
});

// DELETE /api/trips/:id/documents/:documentId
router.delete('/:id/documents/:documentId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, documentId } = req.params;

    if (!isValidObjectId(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }

    const doc = await DocumentModel.findById(documentId);

    if (!doc || doc.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const isUploader = doc.uploadedBy.toString() === req.user!.userId;
    const isAdmin = req.tripMember?.role === 'ADMIN';
    if (!isUploader && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this document' });
    }

    if (doc.publicId) {
      const ownsOld = await verifyAssetOwnership(doc.publicId, req.user!.userId);
      if (ownsOld) {
        const isRaw = !doc.fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
        await deleteFromCloudinary(doc.publicId, isRaw ? 'raw' : 'image');
        await UploadedAsset.deleteOne({ publicId: doc.publicId });
      }
    }

    const name = doc.name;
    await DocumentModel.findByIdAndDelete(documentId);

    await logActivity(tripId, req.user!.userId, 'DOCUMENT_DELETED', `deleted document "${name}"`);
    emitToTrip(tripId, 'document.deleted', { documentId });

    res.json({ message: 'Document deleted successfully' });
  } catch (error: any) {
    handleRouteError(error, res, 'Error deleting document');
  }
});

export default router;
