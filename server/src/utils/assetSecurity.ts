import { UploadedAsset, User, DocumentModel, Booking, Expense, Trip } from '../models';
import { deleteFromCloudinary } from '../config/cloudinary';

/**
 * Verifies whether a given Cloudinary publicId is owned by the specified userId.
 * Checks both the UploadedAsset audit log and existing database references.
 */
export const verifyAssetOwnership = async (publicId: string, userId: string): Promise<boolean> => {
  if (!publicId || typeof publicId !== 'string') return false;
  if (!userId) return false;

  const cleanPublicId = publicId.trim();
  const cleanUserId = userId.toString().trim();

  // 1. Check direct tracking record in UploadedAsset
  const tracked = await UploadedAsset.findOne({ publicId: cleanPublicId });
  if (tracked) {
    return tracked.uploadedBy.toString() === cleanUserId;
  }

  // 2. Fallback for legacy assets: check referencing documents, avatars, bookings, expenses, trips
  const isAvatar = await User.exists({ _id: cleanUserId, avatarPublicId: cleanPublicId });
  if (isAvatar) return true;

  const isDoc = await DocumentModel.exists({ uploadedBy: cleanUserId, publicId: cleanPublicId });
  if (isDoc) return true;

  const isBooking = await Booking.exists({ createdBy: cleanUserId, attachmentPublicId: cleanPublicId });
  if (isBooking) return true;

  const isExpense = await Expense.exists({
    $or: [{ createdBy: cleanUserId }, { paidBy: cleanUserId }],
    receiptPublicId: cleanPublicId
  });
  if (isExpense) return true;

  const isTrip = await Trip.exists({ createdBy: cleanUserId, coverImagePublicId: cleanPublicId });
  if (isTrip) return true;

  return false;
};

/**
 * Safely handles replacing an entity's Cloudinary asset:
 * 1. Verifies that the new asset publicId (if provided) is owned by the user.
 * 2. If valid and oldPublicId is being replaced, ensures oldPublicId was owned by the user
 *    and deletes it from Cloudinary and UploadedAsset.
 */
export const handleEntityAssetReplacement = async (
  oldPublicId: string | undefined,
  newPublicId: string | undefined,
  userId: string,
  resourceType: 'image' | 'raw' = 'image'
): Promise<{ allowed: boolean; error?: string }> => {
  // If setting a new public ID, verify the caller owns that asset
  if (newPublicId && newPublicId !== oldPublicId) {
    const isOwner = await verifyAssetOwnership(newPublicId, userId);
    if (!isOwner) {
      return {
        allowed: false,
        error: 'Access denied: You do not have permission to attach this asset.'
      };
    }
  }

  // If replacing an existing asset with a different one, delete the old asset safely
  if (oldPublicId && newPublicId && oldPublicId !== newPublicId) {
    const ownsOld = await verifyAssetOwnership(oldPublicId, userId);
    if (ownsOld) {
      await deleteFromCloudinary(oldPublicId, resourceType);
      await UploadedAsset.deleteOne({ publicId: oldPublicId });
    }
  }

  return { allowed: true };
};
