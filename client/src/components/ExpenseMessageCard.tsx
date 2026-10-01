import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle, ChevronRight, Utensils, Hotel, Car, ShoppingBag,
  Receipt, CreditCard, MoreVertical, Edit2, Trash2, Clock, CheckCircle2
} from 'lucide-react';

interface ExpenseMessageCardProps {
  expense: any;
  members: any[];
  currentUser?: any;
  onSelect: (expense: any) => void;
  onEdit?: (expense: any, e: React.MouseEvent) => void;
  onDelete?: (id: string, e: React.MouseEvent) => void;
  onPaySplit?: (expense: any, userShare: number, payerName: string, e: React.MouseEvent) => void;
}

export const ExpenseMessageCard: React.FC<ExpenseMessageCardProps> = ({
  expense,
  members,
  currentUser,
  onSelect,
  onEdit,
  onDelete,
  onPaySplit,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const payer = expense.paidBy || {};
  const payerId = String(payer._id || payer);
  const payerName = payer.name || 'Member';
  const participants = expense.participants || [];
  const participantCount = participants.length || members?.length || 1;

  const currentUserId = String(currentUser?._id || currentUser?.id || '');

  // Helper ID comparator
  const getIdStr = (obj: any) => String(obj?._id || obj || '');

  // Check user permissions: Creator, Payer, or Admin
  const isCreator = getIdStr(expense.createdBy) === currentUserId;
  const isPayer = payerId === currentUserId;
  const currentUserMemberDoc = members.find((m) => getIdStr(m.user || m.userId) === currentUserId);
  const isAdmin = currentUserMemberDoc?.role === 'ADMIN';

  const canEditOrDelete = isCreator || isPayer || isAdmin;

  // Compute split paid / pending summary
  const paidParticipants = participants.filter((p: any) => {
    const pId = getIdStr(p.userId);
    return p.status === 'PAID' || pId === payerId;
  });

  const paidCount = paidParticipants.length;
  const totalCount = participants.length || 1;
  const paidSum = paidParticipants.reduce((acc: number, p: any) => acc + (p.share || 0), 0);
  const totalAmount = Number(expense.amount || 0);
  const remainingAmount = Math.max(0, totalAmount - paidSum);
  const isFullySettled = remainingAmount <= 0.01 || (totalCount > 0 && paidCount === totalCount);

  // Check current user's participant entry
  const userParticipant = currentUserId
    ? participants.find((p: any) => getIdStr(p.userId) === currentUserId)
    : null;

  const isUserPayer = isPayer;
  const isUserPending = userParticipant && !isUserPayer && userParticipant.status !== 'PAID';
  const isUserPaid = userParticipant && !isUserPayer && userParticipant.status === 'PAID';
  const userShare = userParticipant?.share || 0;

  // Format date
  const expDate = expense.date ? new Date(expense.date) : new Date();
  const isToday = new Date().toDateString() === expDate.toDateString();
  const dateStr = isToday
    ? 'Today'
    : expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Icon based on Category
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Food':
        return Utensils;
      case 'Accommodation':
        return Hotel;
      case 'Transportation':
      case 'Local Transport':
        return Car;
      case 'Shopping':
        return ShoppingBag;
      default:
        return Receipt;
    }
  };

  const CategoryIcon = getCategoryIcon(expense.category);

  return (
    <div
      onClick={() => onSelect(expense)}
      className="bg-[#1e262c] border border-slate-700/80 hover:border-emerald-500/50 rounded-2xl p-4 cursor-pointer transition-all shadow-xl flex flex-col space-y-3 min-w-[260px] sm:min-w-[300px] max-w-sm group text-left relative"
    >
      {/* Top Header: GPay Payment Tag & Options Menu */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span className="tracking-wide uppercase text-[11px] font-bold">Payment</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          {isFullySettled ? (
            <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Settled
            </span>
          ) : (
            <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {paidCount} of {totalCount} paid
            </span>
          )}

          {/* Subtle "⋮" Menu */}
          {canEditOrDelete && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-700/60 transition-colors"
                title="Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-6 z-20 w-36 bg-[#111b21] border border-slate-700 rounded-xl shadow-2xl py-1 animate-in fade-in duration-150 text-xs">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onEdit(expense, e);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-emerald-400 font-medium transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit expense</span>
                    </button>
                  )}

                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDelete(expense._id, e);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete expense</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Focus: Large Amount */}
      <div className="space-y-0.5">
        <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-1">
          <span>₹{totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Expense Title & Category */}
      <div className="space-y-1">
        <h4 className="font-bold text-slate-100 text-sm group-hover:text-emerald-300 transition-colors line-clamp-1">
          {expense.title}
        </h4>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <CategoryIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>{expense.category}</span>
          <span>•</span>
          <span>{dateStr}</span>
        </div>
      </div>

      {/* Split Details & Payment Summary */}
      <div className="pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 space-y-1">
        <p>Paid by <strong className="text-white font-semibold">{payerName}</strong></p>
        <p className="flex items-center justify-between text-slate-400">
          <span>Split among {participantCount} members</span>
          {!isFullySettled && (
            <span className="text-amber-300 font-medium">{paidCount} paid · ₹{remainingAmount.toLocaleString()} remaining</span>
          )}
        </p>

        {/* User Share Banner */}
        {isUserPending && (
          <div className="mt-1.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-400 font-bold block uppercase">Your Share</span>
              <span className="font-extrabold text-xs">₹{userShare.toLocaleString()}</span>
            </div>
            <span className="text-[10px] font-medium text-amber-300">You owe {payerName} ₹{userShare.toLocaleString()}</span>
          </div>
        )}

        {isUserPaid && (
          <div className="mt-1.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 text-[11px] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>✓ You paid {payerName} ₹{userShare.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Action Footer: Pay / Mark as Paid Button + View Details */}
      <div className="pt-1.5 flex items-center justify-between gap-2 text-xs font-bold">
        {isUserPending && onPaySplit ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPaySplit(expense, userShare, payerName, e);
            }}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1 font-extrabold active:scale-95"
          >
            <span>Mark as Paid</span>
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-slate-400">
            {isUserPayer ? 'You paid full' : isUserPaid ? 'Your share paid' : 'Split settled'}
          </span>
        )}

        <div className="flex items-center gap-1 text-emerald-400 group-hover:text-emerald-300 transition-colors">
          <span>View details</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
};
