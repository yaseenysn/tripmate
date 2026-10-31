import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Upload, AlertCircle, Check, Loader2, Sparkles } from 'lucide-react';
import { apiUpdateTrip, apiUploadFile } from '../services/api';

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  onTripUpdated: (updatedTrip: any) => void;
}

const PRESET_COVERS = [
  { label: 'Mountain', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' },
  { label: 'City', url: 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=800&q=80' },
  { label: 'Heritage', url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80' },
  { label: 'Nature', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80' },
];

export const EditGroupModal: React.FC<EditGroupModalProps> = ({
  isOpen,
  onClose,
  trip,
  onTripUpdated,
}) => {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverImagePublicId, setCoverImagePublicId] = useState<string | undefined>(undefined);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && trip) {
      setName(trip.name || '');
      setDestination(trip.destination || '');
      setDescription(trip.description || '');
      setCoverImage(trip.coverImage || '');
      setCoverImagePublicId(trip.coverImagePublicId || undefined);
      setError(null);
    }
  }, [isOpen, trip]);

  if (!isOpen || !trip) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const lastDot = file.name.lastIndexOf('.');
    const fileExt = lastDot !== -1 ? file.name.toLowerCase().substring(lastDot) : '';

    if (!allowedMimeTypes.includes(file.type) || !allowedExtensions.includes(fileExt)) {
      setError('Please select a valid image file (JPEG, PNG, WEBP). SVG and other formats are not allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must not exceed 10MB.');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const uploadRes = await apiUploadFile(file, 'trips');
      setCoverImage(uploadRes.url || uploadRes.secureUrl);
      setCoverImagePublicId(uploadRes.publicId);
    } catch (err: any) {
      console.error('Group photo upload failed:', err);
      setError(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (url: string) => {
    setCoverImage(url);
    setCoverImagePublicId(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }
    if (name.trim().length > 150) {
      setError('Group name cannot exceed 150 characters.');
      return;
    }
    if (!destination.trim()) {
      setError('Destination is required.');
      return;
    }
    if (destination.trim().length > 150) {
      setError('Destination cannot exceed 150 characters.');
      return;
    }
    if (description.trim().length > 2000) {
      setError('Description cannot exceed 2000 characters.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await apiUpdateTrip(trip._id, {
        name: name.trim(),
        destination: destination.trim(),
        description: description.trim(),
        coverImage: coverImage.trim() || undefined,
        coverImagePublicId: coverImagePublicId || undefined,
      });

      onTripUpdated(res.trip);
      onClose();
    } catch (err: any) {
      console.error('Error updating group details:', err);
      setError(err.message || 'Failed to update group details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Admin Settings
          </span>
          <h2 className="text-xl font-extrabold text-slate-100 mt-1">Edit Group Details</h2>
          <p className="text-xs text-slate-400">Update group name, cover photo, destination and description</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Photo Preview & Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Group Cover Photo
            </label>
            <div className="relative h-36 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 group">
              <img
                src={coverImage || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80'}
                alt="Cover preview"
                className="w-full h-full object-cover filter brightness-75 group-hover:brightness-60 transition-all"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="px-3.5 py-2 bg-slate-950/80 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 backdrop-blur-sm transition-all shadow-lg"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>Change Photo</span>
                    </>
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 flex-shrink-0">
                <Sparkles className="w-3 h-3 text-slate-400" /> Presets:
              </span>
              {PRESET_COVERS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelectPreset(preset.url)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex-shrink-0 ${coverImage === preset.url
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                      : 'bg-[#1f2c34] text-slate-400 border-slate-700/80 hover:text-slate-200'
                    }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Group Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={150}
              placeholder="e.g. Goa Beach Trip 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1f2c34] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Destination */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Destination <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={150}
              placeholder="e.g. North Goa, India"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-[#1f2c34] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Group Description
              </label>
              <span className="text-[10px] text-slate-500">{description.length}/2000</span>
            </div>
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="Add details, itinerary highlights, rules or reminders for group members..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#1f2c34] border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

