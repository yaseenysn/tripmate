import React, { useState } from 'react';
import { X, KeyRound, ArrowRight } from 'lucide-react';
import { apiJoinWithCode } from '../services/api';

interface JoinTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined: (tripId: string) => void;
}

export const JoinTripModal: React.FC<JoinTripModalProps> = ({ isOpen, onClose, onJoined }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length < 4) {
      setError('Please enter a valid invite code (e.g. LKO8X2)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiJoinWithCode(code.trim());
      onJoined(res.tripId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Join a Trip</h2>
            <p className="text-xs text-slate-400">Enter 6-character trip invite code</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Invite Code
            </label>
            <input
              type="text"
              placeholder="e.g. LKO8X2"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-xl px-4 py-3 text-center tracking-widest text-lg font-mono text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-slate-500"
            />
          </div>

          <div className="pt-2 flex gap-3">
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
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'Joining...' : (
                <>
                  <span>Join Trip</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
