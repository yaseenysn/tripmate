import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, DollarSign, Wallet, Users } from 'lucide-react';
import { apiRecordSettlement, apiPaySettlement } from '../services/api';

interface SettlementsViewProps {
  tripId: string;
  settlementsData: any;
  onRefresh: () => void;
}

export const SettlementsView: React.FC<SettlementsViewProps> = ({
  tripId,
  settlementsData,
  onRefresh
}) => {
  const [loading, setLoading] = useState(false);

  const memberBalances = settlementsData?.memberBalances || [];
  const suggestedSettlements = settlementsData?.suggestedSettlements || [];
  const recordedSettlements = settlementsData?.recordedSettlements || [];

  const handleSettlePair = async (fromUser: any, toUser: any, amount: number) => {
    setLoading(true);
    try {
      await apiRecordSettlement(tripId, {
        fromUser: fromUser._id,
        toUser: toUser._id,
        amount
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-panel p-6 rounded-3xl">
        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
          Trip Debt Optimization
        </span>
        <h2 className="text-xl font-bold text-slate-100">Settlements & Balances</h2>
      </div>

      {/* Suggested Settlements Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Optimal Settlement Suggestions
        </h3>

        {suggestedSettlements.length === 0 ? (
          <div className="glass-card p-6 rounded-2xl text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="font-bold text-slate-200 text-sm">All balances are settled!</p>
            <p className="text-xs text-slate-500 mt-0.5">Nobody owes anyone money right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestedSettlements.map((s: any, idx: number) => (
              <div key={idx} className="glass-card p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm">{s.fromUser.name}</span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <span className="font-bold text-slate-100 text-sm">{s.toUser.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-base font-extrabold text-emerald-400">
                    ₹{s.amount.toLocaleString()}
                  </span>

                  <button
                    onClick={() => handleSettlePair(s.fromUser, s.toUser, s.amount)}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-md transition-all flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Paid</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Balances Table */}
      <div className="glass-panel p-5 rounded-3xl space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Individual Balances Breakdown
        </h3>
        <div className="divide-y divide-slate-800/80">
          {memberBalances.map((mb: any) => (
            <div key={mb.userId} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                  {mb.avatar ? <img src={mb.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : mb.name[0]}
                </div>
                <div>
                  <span className="font-bold text-slate-100 block">{mb.name}</span>
                  <span className="text-slate-400 text-[10px]">
                    Paid ₹{mb.totalPaid.toLocaleString()} • Share ₹{mb.totalShare.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className={`font-extrabold text-sm block ${mb.netBalance > 0 ? 'text-emerald-400' : mb.netBalance < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {mb.netBalance > 0 ? `Gets ₹${mb.netBalance.toLocaleString()}` : mb.netBalance < 0 ? `Owes ₹${Math.abs(mb.netBalance).toLocaleString()}` : 'Settled'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
