import React, { useState } from 'react';
import { Handshake, CheckCircle2, ArrowRight, DollarSign, X } from 'lucide-react';
import { apiPaySettlement } from '../services/api';

interface SettlementSheetProps {
  tripId: string;
  settlementsData: any;
  onRefresh: () => void;
}

export const SettlementSheet: React.FC<SettlementSheetProps> = ({
  tripId,
  settlementsData,
  onRefresh,
}) => {
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const userBalances = settlementsData?.userBalances || [];
  const settlements = settlementsData?.settlements || [];

  const handlePaySettlement = async (settlementId: string) => {
    setLoading(true);
    try {
      await apiPaySettlement(tripId, settlementId);
      setSelectedSettlement(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4 animate-in fade-in duration-200">
      {/* Overview Cards */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
          Net Member Balances
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {userBalances.map((b: any) => {
            const isPositive = b.netBalance >= 0;

            return (
              <div
                key={b.userId?._id || b.userId}
                className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={b.userId?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-200">{b.userId?.name || 'Member'}</p>
                    <p className="text-[10px] text-slate-500">
                      Paid ₹{b.totalPaid.toLocaleString()} • Share ₹{b.totalShare.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xs font-extrabold block ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? `+₹${b.netBalance.toLocaleString()}` : `-₹${Math.abs(b.netBalance).toLocaleString()}`}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">
                    {isPositive ? 'Receives' : 'Owes'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested Optimized Transactions List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Optimized Settlements ({settlements.length})
        </h3>

        {settlements.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-2">
            <Handshake className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-slate-200">All settled up!</p>
            <p className="text-xs text-slate-500">No pending balances remaining between members.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {settlements.map((s: any) => {
              const isPaid = s.status === 'PAID';

              return (
                <div
                  key={s._id}
                  className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:border-indigo-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Handshake className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                        <span>{s.fromUser?.name || 'User'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span>{s.toUser?.name || 'User'}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {isPaid ? 'Settled on ' + new Date(s.paidAt || Date.now()).toLocaleDateString() : 'Pending settlement'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-base font-extrabold text-slate-100 block">
                        ₹{s.amount.toLocaleString()}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                        isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {isPaid ? '✓ SETTLED' : '⏳ PENDING'}
                      </span>
                    </div>

                    {!isPaid && (
                      <button
                        onClick={() => setSelectedSettlement(s)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition-all"
                      >
                        Settle Up
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settle Up Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4">
            <h4 className="text-base font-bold text-slate-100">Confirm Settlement</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Mark transaction of <strong className="text-white">₹{selectedSettlement.amount.toLocaleString()}</strong> from{' '}
              <strong className="text-indigo-300">{selectedSettlement.fromUser?.name}</strong> to{' '}
              <strong className="text-indigo-300">{selectedSettlement.toUser?.name}</strong> as settled?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSettlement(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handlePaySettlement(selectedSettlement._id)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg transition-all"
              >
                {loading ? 'Processing...' : 'Mark as Settled'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
