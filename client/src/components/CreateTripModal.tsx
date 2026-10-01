import React, { useState } from 'react';
import { X, Calendar, MapPin, IndianRupee, Image as ImageIcon, Sparkles } from 'lucide-react';
import { apiCreateTrip } from '../services/api';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripCreated: (trip: any) => void;
}

const PRESET_COVERS = [
  { name: 'Lucknow Heritage', url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80' },
  { name: 'Kerala Backwaters', url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80' },
  { name: 'Kashmir Snow', url: 'https://images.unsplash.com/photo-1566837945700-30057527ade0?auto=format&fit=crop&w=800&q=80' },
  { name: 'Delhi Landmarks', url: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=800&q=80' },
  { name: 'Goa Beaches', url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80' }
];

export const CreateTripModal: React.FC<CreateTripModalProps> = ({ isOpen, onClose, onTripCreated }) => {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('50000');
  const [coverImage, setCoverImage] = useState(PRESET_COVERS[0].url);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !destination || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiCreateTrip({
        name,
        destination,
        startDate,
        endDate,
        estimatedBudget: Number(estimatedBudget) || 0,
        coverImage,
        description
      });
      onTripCreated(data.trip);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Create New Trip</h2>
            <p className="text-xs text-slate-400">Set up your collaborative trip workspace</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Trip Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Lucknow Heritage Trip"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Destination *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. Lucknow, UP"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Estimated Budget (₹)
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                placeholder="80000"
                value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Cover Image Preset
            </label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {PRESET_COVERS.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setCoverImage(preset.url)}
                  className={`relative rounded-xl overflow-hidden h-14 border-2 transition-all ${coverImage === preset.url ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/30' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add notes about the trip..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-xl p-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm py-2.5 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
