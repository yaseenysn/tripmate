import React, { useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiPayExpenseSplit } from '../services/api';

interface PaySplitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  expense: any;
  userShare: number;
  payerName: string;
  onSuccess: () => void;
}

export const PaySplitConfirmationModal: React.FC<PaySplitConfirmationModalProps> = ({
  isOpen,
  onClose,
  tripId,
  expense,
  userShare,
  payerName,
  onSuccess,
}) => {
  if (!isOpen || !expense) return null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirmPay = async () => {
    setLoading(true);
    setError('');

    try {
      await apiPayExpenseSplit(tripId, expense._id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mark payment as paid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4 text-center">
        {/* Header Icon */}
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
          <CreditCard className="w-6 h-6" />
        </div>

        {/* Title & Info */}
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-white">
            Have you paid ₹{Number(userShare).toLocaleString()} to {payerName}?
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Confirming that you have paid your share of <strong className="text-slate-200">₹{userShare.toLocaleString()}</strong> to <strong className="text-emerald-400">{payerName}</strong> for "<span className="text-slate-200">{expense.title}</span>".
          </p>
        </div>

        {/* Note */}
        <div className="p-2.5 rounded-xl bg-[#1f2c34] border border-slate-700/60 text-[11px] text-slate-300 flex items-center gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>This will mark your split status as PAID and update trip settlements.</span>
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-medium">{error}</p>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmPay}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-all shadow-lg flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Yes, Mark as Paid</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
