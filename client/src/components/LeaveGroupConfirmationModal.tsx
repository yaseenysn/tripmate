import React, { useState } from 'react';
import { X, LogOut, AlertTriangle, AlertCircle, ShieldAlert, Loader2, IndianRupee } from 'lucide-react';
import { apiLeaveTrip } from '../services/api';

interface LeaveGroupConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  currentUser: any;
  members: any[];
  onLeftGroup: () => void;
}

export const LeaveGroupConfirmationModal: React.FC<LeaveGroupConfirmationModalProps> = ({
  isOpen,
  onClose,
  trip,
  currentUser,
  members,
  onLeftGroup,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !trip || !currentUser) return null;

  const currentUserId = String(currentUser._id || currentUser.id);
  const ownerId = String(trip.createdBy?._id || trip.createdBy || '');
  const isOwner = ownerId === currentUserId;
  const totalMembers = members.length;

  // Find user's member entry
  const currentMemberEntry = members.find((m) => {
    const uId = String(m.user?._id || m.userId?._id || m.userId || '');
    return uId === currentUserId;
  });

  const isAdmin = currentMemberEntry?.role === 'ADMIN';
  const adminCount = members.filter((m) => m.role === 'ADMIN').length;
  const isSoleAdmin = isAdmin && adminCount <= 1;

  // Net balance check
  const netBalance = currentMemberEntry?.netBalance || 0;
  const hasUnsettledBalance = Math.abs(netBalance) > 0.01;

  // Determine if leaving is blocked (structural rules first, then financial balance)
  let blockReason: string | null = null;
  if (isOwner && totalMembers > 1) {
    blockReason =
      'You are the group owner. You must transfer group ownership to another member before leaving the group.';
  } else if (isSoleAdmin && totalMembers > 1) {
    blockReason =
      'You are the sole administrator of this group. Please promote another member to admin before leaving.';
  } else if (hasUnsettledBalance) {
    const isOwed = netBalance > 0;
    blockReason = `You have an unsettled balance of ₹${Math.abs(netBalance).toFixed(2)} (${isOwed ? 'to receive' : 'to pay'
      }). All balances must be settled before you can leave the group.`;
  }

  const handleLeave = async () => {
    if (blockReason) return;

    setLoading(true);
    setError(null);

    try {
      await apiLeaveTrip(trip._id);
      onLeftGroup();
      onClose();
    } catch (err: any) {
      console.error('Error leaving group:', err);
      setError(err.message || 'Failed to leave group. Please check any pending balances.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 flex-shrink-0">
            <LogOut className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Leave Group</h2>
            <p className="text-xs text-slate-400">"{trip.name}"</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Blocking Alert if rules prevent leaving */}
        {blockReason ? (
          <div className="space-y-4 mb-5">
            <div className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-xs text-rose-300">
              {hasUnsettledBalance ? (
                <IndianRupee className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold text-rose-200">Cannot Leave Group Yet</p>
                <p className="text-slate-300 text-[11px] leading-relaxed">{blockReason}</p>
              </div>
            </div>

            <div className="p-3 bg-[#1f2c34] rounded-xl border border-slate-800 text-xs text-slate-400">
              <span className="text-slate-300 font-semibold block mb-0.5">What to do next:</span>
              <p className="text-[11px]">
                {hasUnsettledBalance
                  ? 'Head over to the Settlements section to record or reconcile outstanding balances.'
                  : isOwner
                    ? 'Ask another member to take over group ownership or delete the group if all members agree.'
                    : 'Open the Members list and promote another member to Admin.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-5">
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Are you sure you want to leave this group?
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                <li>You will no longer receive group messages, updates, or trip notifications.</li>
                <li>Your previous expense logs and shared bookings will remain preserved for group transparency.</li>
                <li>You can only rejoin if another member sends you an invite link.</li>
              </ul>
            </div>

            <div className="p-2.5 bg-[#1f2c34] rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Your Net Balance:</span>
              <span className="font-bold text-emerald-400">₹0.00 (Fully Settled)</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
          >
            {blockReason ? 'Close' : 'Cancel'}
          </button>
          {!blockReason && (
            <button
              type="button"
              onClick={handleLeave}
              disabled={loading}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Leaving Group...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Leave Group</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

