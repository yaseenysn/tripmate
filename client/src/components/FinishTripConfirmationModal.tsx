import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle2, X, Users, DollarSign, Wallet,
  Clock, ShieldAlert, ArrowRight
} from 'lucide-react';
import { apiGetTripFinishPreview, apiFinishTrip } from '../services/api';

interface FinishTripConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  onTripFinished: (updatedTrip: any) => void;
}

export const FinishTripConfirmationModal: React.FC<FinishTripConfirmationModalProps> = ({
  isOpen,
  onClose,
  tripId,
  onTripFinished
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !tripId) return;

    let mounted = true;
    const fetchPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetTripFinishPreview(tripId);
        if (mounted) setPreview(data);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load trip preview');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPreview();
    return () => {
      mounted = false;
    };
  }, [isOpen, tripId]);

  if (!isOpen) return null;

  const handleConfirmFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFinishTrip(tripId);
      onTripFinished(res.trip);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to finish trip');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#1f2c34]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Finish Trip Confirmation</h3>
              <p className="text-[11px] text-slate-400">{preview?.tripName || 'Confirm trip conclusion'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Auditing trip expenses and balances...</p>
            </div>
          ) : error && !preview ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          ) : (
            <>
              {/* Notice Banner */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-relaxed space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Important Lifecycle Notice</span>
                </p>
                <p className="text-amber-200/90 text-[11px]">
                  Marking this trip as <strong>COMPLETED</strong> indicates travel has concluded.
                  All expenses, member balances, and settlements remain <strong>fully accessible</strong>.
                  Pending settlements will <strong>NOT</strong> be marked as paid automatically.
                </p>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#1f2c34] p-3 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Spent</span>
                  <span className="text-sm font-extrabold text-white">
                    ₹{(preview?.totalExpenses || 0).toLocaleString()}
                  </span>
                </div>

                <div className="bg-[#1f2c34] p-3 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Members</span>
                  <span className="text-sm font-extrabold text-slate-200">
                    {preview?.memberCount || 0}
                  </span>
                </div>

                <div className="bg-[#1f2c34] p-3 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Pmt.</span>
                  <span className="text-sm font-extrabold text-amber-400">
                    {preview?.pendingSettlementsCount || 0}
                  </span>
                </div>

                <div className="bg-[#1f2c34] p-3 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Outstanding</span>
                  <span className={`text-sm font-extrabold ${preview?.outstandingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ₹{(preview?.outstandingAmount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Outstanding Balances List Preview */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Member Balances Overview
                </span>

                <div className="divide-y divide-slate-800/80 bg-[#1f2c34]/60 rounded-2xl border border-slate-700/60 max-h-40 overflow-y-auto px-3">
                  {(preview?.memberBalances || []).map((mb: any) => (
                    <div key={mb.userId} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-200 block">{mb.name}</span>
                        <span className="text-[10px] text-slate-400">
                          Paid ₹{mb.totalPaid.toLocaleString()} • Share ₹{mb.totalShare.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`font-extrabold text-xs block ${mb.netBalance > 0 ? 'text-emerald-400' : mb.netBalance < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {mb.netBalance > 0
                            ? `+₹${mb.netBalance.toLocaleString()}`
                            : mb.netBalance < 0
                            ? `-₹${Math.abs(mb.netBalance).toLocaleString()}`
                            : 'Settled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-800 bg-[#1f2c34]/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmFinish}
            disabled={submitting || loading}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Finish Trip</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
