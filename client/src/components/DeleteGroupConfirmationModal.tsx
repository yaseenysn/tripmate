import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, ShieldCheck, Loader2, Users, Receipt } from 'lucide-react';
import { apiDeleteTrip } from '../services/api';

interface DeleteGroupConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  membersCount: number;
  onTripDeleted: () => void;
}

export const DeleteGroupConfirmationModal: React.FC<DeleteGroupConfirmationModalProps> = ({
  isOpen,
  onClose,
  trip,
  membersCount,
  onTripDeleted,
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !trip) return null;

  const groupName = trip.name || 'Trip Group';
  const isMatch = typedConfirmation.trim() === groupName.trim();

  const handleDelete = async () => {
    if (!isMatch) return;

    setLoading(true);
    setError(null);

    try {
      await apiDeleteTrip(trip._id);
      onTripDeleted();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete group:', err);
      setError(err.message || 'Failed to delete group. Please ensure you have admin rights.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#111b21] border border-rose-500/30 rounded-3xl max-w-md w-full shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Danger Warning */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10 flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Delete Group</h2>
            <p className="text-xs text-rose-400 font-semibold">Irreversible action</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Consequence Explanation */}
        <div className="space-y-3 mb-5">
          <div className="p-3.5 bg-rose-950/20 border border-rose-500/20 rounded-2xl text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-rose-200">
              Are you sure you want to permanently delete <span className="text-white font-bold underline">"{groupName}"</span>?
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
              <li>All chat messages, polls, tasks, bookings, and itinerary items will be permanently erased.</li>
              <li>All members ({membersCount}) will lose access to this group workspace immediately.</li>
            </ul>
          </div>

          {/* Financial Safety Notice */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-2.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-200">Strict Financial Safety:</strong> Historical confirmed payment transactions and settled ledger records remain safely archived for accounting integrity.
            </span>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-[#1f2c34] rounded-xl border border-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] text-slate-500 block">Members</span>
                <span className="font-bold text-slate-200">{membersCount} members</span>
              </div>
            </div>
            <div className="p-2.5 bg-[#1f2c34] rounded-xl border border-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] text-slate-500 block">Total Spent</span>
                <span className="font-bold text-emerald-400">₹{(trip.totalSpent || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Typed Confirmation Input */}
        <div className="space-y-2 mb-5">
          <label className="block text-xs font-semibold text-slate-300">
            Please type <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded font-bold">{groupName}</span> to confirm:
          </label>
          <input
            type="text"
            placeholder={groupName}
            value={typedConfirmation}
            onChange={(e) => setTypedConfirmation(e.target.value)}
            disabled={loading}
            className="w-full bg-[#1f2c34] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isMatch || loading}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting Group...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Permanently Delete Group</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

