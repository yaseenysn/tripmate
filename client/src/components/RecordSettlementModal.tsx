import React, { useState } from 'react';
import { X, CreditCard, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { apiRecordSettlement } from '../services/api';

interface RecordSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  settlementData: any; // suggested settlement object
  currency?: string;
  onSettlementRecorded: () => void;
}

export const RecordSettlementModal: React.FC<RecordSettlementModalProps> = ({
  isOpen,
  onClose,
  tripId,
  settlementData,
  currency = '₹',
  onSettlementRecorded
}) => {
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (settlementData) {
      setAmount(String(settlementData.amount || ''));
      setNotes(`Settlement payment between ${settlementData.fromUser?.name} and ${settlementData.toUser?.name}`);
      setReference('');
      setError(null);
      const fromId = settlementData.fromUser?._id;
      const toId = settlementData.toUser?._id;
      setIdempotencyKey(`rec_${tripId}_${fromId}_${toId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    }
  }, [settlementData, tripId]);

  if (!isOpen || !settlementData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid positive payment amount.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const fromUserId = settlementData.fromUser?._id;
      const toUserId = settlementData.toUser?._id;
      const activeIdempotencyKey = idempotencyKey || `rec_${tripId}_${fromUserId}_${toUserId}_${Date.now()}`;

      await apiRecordSettlement(tripId, {
        fromUser: fromUserId,
        toUser: toUserId,
        amount: Number(amount),
        notes: notes.trim() || undefined,
        reference: reference.trim() || undefined,
        idempotencyKey: activeIdempotencyKey,
        settlementId: settlementData.settlementId
      });

      onSettlementRecorded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record settlement payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#1f2c34]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Record Settlement Payment</h3>
              <p className="text-xs text-slate-400">Confirm payment transfer between members</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-200">
          {/* Transfer Summary Badge */}
          <div className="bg-[#1f2c34] p-3.5 rounded-2xl border border-slate-700/60 flex items-center justify-between">
            <div className="text-center flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payer</span>
              <span className="font-bold text-white text-xs">{settlementData.fromUser?.name}</span>
            </div>

            <ArrowRight className="w-4 h-4 text-emerald-400 flex-shrink-0 mx-2" />

            <div className="text-center flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Receiver</span>
              <span className="font-bold text-white text-xs">{settlementData.toUser?.name}</span>
            </div>
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Payment Amount ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold">{currency}</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-[#111b21] border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-white font-extrabold text-sm focus:outline-none focus:border-emerald-500"
                placeholder="0.00"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Suggested amount: {currency}{Number(settlementData.amount).toFixed(2)}. Partial payments are supported.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Payment Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              placeholder="e.g. Paid via Google Pay / UPI / Cash"
            />
          </div>

          {/* Reference / Transaction ID */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Transaction ID / Reference (Optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              placeholder="e.g. UPI-123456789"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Record Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
