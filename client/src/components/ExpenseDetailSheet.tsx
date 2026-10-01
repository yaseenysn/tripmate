import React, { useState } from 'react';
import { X, CheckCircle, Clock, Trash2, Edit2, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { PaySplitConfirmationModal } from './PaySplitConfirmationModal';

interface ExpenseDetailSheetProps {
  expense: any;
  members: any[];
  currentUser?: any;
  onClose: () => void;
  onEdit?: (expense: any) => void;
  onDelete?: (id: string) => void;
  onPaySplit?: (expense: any, userShare: number, payerName: string) => void;
}

export const ExpenseDetailSheet: React.FC<ExpenseDetailSheetProps> = ({
  expense,
  members,
  currentUser,
  onClose,
  onEdit,
  onDelete,
  onPaySplit,
}) => {
  if (!expense) return null;

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getIdStr = (obj: any) => String(obj?._id || obj || '');
  const currentUserId = getIdStr(currentUser);

  const payer = expense.paidBy || {};
  const payerId = getIdStr(payer);
  const payerName = payer.name || 'Member';
  const participants = expense.participants || [];
  const totalAmount = Number(expense.amount || 0);

  const perShare = participants.length > 0
    ? Math.round(totalAmount / participants.length)
    : totalAmount;

  const expDate = expense.date ? new Date(expense.date) : new Date();
  const dateStr = expDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Permissions check
  const isCreator = getIdStr(expense.createdBy) === currentUserId;
  const isPayer = payerId === currentUserId;
  const currentUserMemberDoc = members.find((m) => getIdStr(m.user || m.userId) === currentUserId);
  const isAdmin = currentUserMemberDoc?.role === 'ADMIN';

  const canEditOrDelete = isCreator || isPayer || isAdmin;

  // Compute breakdown summary
  const paidParticipants = participants.filter((p: any) => {
    const pId = getIdStr(p.userId);
    return p.status === 'PAID' || pId === payerId;
  });

  const paidCount = paidParticipants.length;
  const totalCount = participants.length || 1;
  const paidSum = paidParticipants.reduce((acc: number, p: any) => acc + (p.share || 0), 0);
  const remainingAmount = Math.max(0, totalAmount - paidSum);

  // Check current user participant entry
  const userParticipant = currentUserId
    ? participants.find((p: any) => getIdStr(p.userId) === currentUserId)
    : null;

  const isUserPending = userParticipant && !isPayer && userParticipant.status !== 'PAID';
  const isUserPaid = userParticipant && !isPayer && userParticipant.status === 'PAID';
  const userShare = userParticipant?.share || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl max-w-md w-full p-6 relative space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Transaction Header (Google Pay Receipt Style) */}
        <div className="text-center space-y-1.5 pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 inline-block">
            {expense.category}
          </span>
          <h3 className="text-xl font-extrabold text-slate-100">{expense.title}</h3>
          <div className="text-3xl font-black text-white pt-1 tracking-tight">
            ₹{totalAmount.toLocaleString()}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold pt-1">
            <CheckCircle className="w-4 h-4" />
            <span>PAID • {dateStr}</span>
          </div>
        </div>

        {/* Current User Share Banner & CTA */}
        {isUserPending && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3 text-left">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase block">Your Share</span>
                <span className="text-xl font-black text-amber-300">₹{userShare.toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-amber-400 font-bold block uppercase">To {payerName}</span>
                <span className="text-xs font-semibold text-amber-300">Payment status: ⏳ Pending</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-1.5 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Yes, Mark as Paid</span>
            </button>
          </div>
        )}

        {isUserPaid && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs font-semibold">
            <div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase block">Your Share</span>
              <span className="text-base font-extrabold">₹{userShare.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>✓ Paid to {payerName}</span>
            </div>
          </div>
        )}

        {/* Expense Metadata Summary */}
        <div className="bg-[#1f2c34] p-4 rounded-2xl border border-slate-700/60 space-y-2.5 text-xs text-left">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Paid By</span>
            <span className="font-extrabold text-emerald-400">{payerName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Split Method</span>
            <span className="font-bold text-slate-200">{expense.splitType || 'EQUAL'}</span>
          </div>

          {expense.notes && (
            <div className="pt-2 border-t border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Notes</span>
              <p className="text-xs text-slate-300 italic">{expense.notes}</p>
            </div>
          )}
        </div>

        {/* Per Person Split Breakdown */}
        <div className="space-y-2 text-left">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per Person Split</h4>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {participants.map((p: any, idx: number) => {
              const pId = getIdStr(p.userId);
              const uObj = p.userId?.name
                ? p.userId
                : members.find((m) => getIdStr(m.user || m.userId) === pId)?.user;
              const personName = uObj?.name || `Member ${idx + 1}`;
              const share = p.share !== undefined ? p.share : perShare;
              const isPayerMember = pId === payerId;
              const isPaid = p.status === 'PAID' || isPayerMember;

              return (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#1f2c34] border border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-semibold">{personName}</span>
                    {isPayerMember && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Payer</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white">₹{share.toLocaleString()}</span>
                    {isPaid ? (
                      <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Summary Box */}
        <div className="bg-[#1f2c34] p-3.5 rounded-2xl border border-slate-700/60 space-y-1.5 text-xs text-left">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span>Paid</span>
            <span className="font-extrabold text-emerald-400">
              ₹{paidSum.toLocaleString()} / ₹{totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Remaining</span>
            <span className={`font-bold ${remainingAmount > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
              ₹{remainingAmount.toLocaleString()}
            </span>
          </div>
          <div className="pt-1 border-t border-slate-700/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span>✓ {paidCount} of {totalCount} members paid</span>
            {remainingAmount <= 0.01 && (
              <span className="text-emerald-400 font-bold uppercase">Fully Settled</span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex gap-2">
          {canEditOrDelete && onEdit && (
            <button
              onClick={() => {
                onEdit(expense);
                onClose();
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}

          {canEditOrDelete && onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this expense?')) {
                  onDelete(expense._id);
                  onClose();
                }
              }}
              className="flex-1 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && onPaySplit && (
        <PaySplitConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          tripId={expense.tripId}
          expense={expense}
          userShare={userShare}
          payerName={payerName}
          onSuccess={() => {
            setShowConfirmModal(false);
            onPaySplit(expense, userShare, payerName);
          }}
        />
      )}
    </div>
  );
};
