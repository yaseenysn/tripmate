import React from 'react';
import { Receipt, CheckCircle, Clock, Trash2, Utensils, Hotel, Car, ShoppingBag, AlertCircle, Sparkles } from 'lucide-react';

interface ExpenseCardProps {
  expense: any;
  members: any[];
  onSelect: (exp: any) => void;
  onDelete?: (id: string, e: React.MouseEvent) => void;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  expense,
  members,
  onSelect,
  onDelete,
}) => {
  const payerName = expense.paidBy?.name || 'Someone';
  const participantCount = expense.participants?.length || members.length || 1;
  const dateStr = new Date(expense.date).toLocaleDateString([], { month: 'short', day: 'numeric' });

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

  const IconComponent = getCategoryIcon(expense.category);

  return (
    <div
      onClick={() => onSelect(expense)}
      className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-2xl cursor-pointer transition-all shadow-sm flex flex-col justify-between space-y-3 group"
    >
      {/* Top Header: Category Badge & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-semibold">
          <IconComponent className="w-3.5 h-3.5" />
          <span>{expense.category}</span>
        </div>

        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          PAID
        </span>
      </div>

      {/* Main Body: Title & Prominent Google Pay Amount */}
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-bold text-slate-100 text-sm sm:text-base group-hover:text-indigo-300 transition-colors truncate">
          {expense.title}
        </h4>
        <div className="text-xl sm:text-2xl font-extrabold text-white flex-shrink-0 tracking-tight">
          ₹{expense.amount.toLocaleString()}
        </div>
      </div>

      {/* Footer Details: Payer, Split & Actions */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span>Paid by <strong className="text-indigo-300 font-medium">{payerName}</strong></span>
          <span>•</span>
          <span>Split among {participantCount} members</span>
          <span>•</span>
          <span>{dateStr}</span>
        </div>

        {onDelete && (
          <button
            onClick={(e) => onDelete(expense._id, e)}
            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
            title="Delete expense"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
