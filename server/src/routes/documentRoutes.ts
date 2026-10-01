import { Router, Response } from 'express';
import { DocumentModel } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';

const router = Router();

// GET /api/trips/:id/documents
router.get('/:id/documents', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const documents = await DocumentModel.find({ tripId }).populate('uploadedBy', 'name avatar').sort({ createdAt: -1 });
    res.json({ documents });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching documents' });
  }
});

// POST /api/trips/:id/documents
router.post('/:id/documents', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { name, type, fileUrl, fileSize } = req.body;

    if (!name || !fileUrl) {
      return res.status(400).json({ error: 'Name and file URL are required' });
    }

    const doc = await DocumentModel.create({
      tripId,
      name,
      type: type || 'OTHER',
      fileUrl,
      fileSize: fileSize || '1.2 MB',
      uploadedBy: userId
    });

    const populated = await DocumentModel.findById(doc._id).populate('uploadedBy', 'name avatar');

    await logActivity(tripId, userId, 'DOCUMENT_UPLOADED', `uploaded document "${name}"`);
    emitToTrip(tripId, 'document.created', populated);

    res.status(201).json({ document: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error uploading document' });
  }
});

// DELETE /api/trips/:id/documents/:documentId
router.delete('/:id/documents/:documentId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, documentId } = req.params;
    const doc = await DocumentModel.findById(documentId);

    if (!doc || doc.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const name = doc.name;
    await DocumentModel.findByIdAndDelete(documentId);

    await logActivity(tripId, req.user!.userId, 'DOCUMENT_DELETED', `deleted document "${name}"`);
    emitToTrip(tripId, 'document.deleted', { documentId });

    res.json({ message: 'Document deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting document' });
  }
});

export default router;
