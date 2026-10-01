import React, { useState } from 'react';
import { Plus, Receipt, Edit2, Trash2 } from 'lucide-react';
import { apiDeleteExpense } from '../services/api';
import { AddEditExpenseModal } from './AddEditExpenseModal';
import { PaySplitConfirmationModal } from './PaySplitConfirmationModal';
import { ExpenseMessageCard } from './ExpenseMessageCard';

interface ExpensesViewProps {
  tripId: string;
  expenses: any[];
  members: any[];
  currentUser: any;
  openAddModal?: boolean;
  onRefresh: () => void;
}

const CATEGORIES = [
  'Transportation',
  'Accommodation',
  'Food',
  'Activities',
  'Local Transport',
  'Shopping',
  'Emergency',
  'Miscellaneous'
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  tripId,
  expenses,
  members,
  currentUser,
  openAddModal = false,
  onRefresh
}) => {
  const [showAddModal, setShowAddModal] = useState(openAddModal);
  const [expenseToEdit, setExpenseToEdit] = useState<any>(null);
  const [paySplitInfo, setPaySplitInfo] = useState<{ expense: any; userShare: number; payerName: string } | null>(null);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  React.useEffect(() => {
    if (openAddModal) {
      setExpenseToEdit(null);
      setShowAddModal(true);
    }
  }, [openAddModal]);

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const filteredExpenses = selectedCategoryFilter === 'ALL'
    ? expenses
    : expenses.filter(e => e.category === selectedCategoryFilter);

  const handleDeleteExpense = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await apiDeleteExpense(tripId, id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-[#111b21] p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">
            Trip Expense Tracker
          </span>
          <h2 className="text-2xl font-black text-slate-100 flex items-baseline gap-2">
            ₹{totalSpent.toLocaleString()}
            <span className="text-xs font-normal text-slate-400">Total Spent</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-[#1f2c34] border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none font-semibold"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setExpenseToEdit(null);
              setShowAddModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Expense Cards Grid */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-[#111b21] p-12 rounded-3xl border border-slate-800 text-center space-y-2">
          <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-300">No expenses recorded yet</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Tap "+ Add Expense" to start tracking payments and splitting costs with trip members.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredExpenses.map(expense => (
            <ExpenseMessageCard
              key={expense._id}
              expense={expense}
              members={members}
              currentUser={currentUser}
              onSelect={() => {}}
              onEdit={(exp, e) => {
                if (e) e.stopPropagation();
                setExpenseToEdit(exp);
                setShowAddModal(true);
              }}
              onDelete={handleDeleteExpense}
              onPaySplit={(exp, userShare, payerName, e) => {
                if (e) e.stopPropagation();
                setPaySplitInfo({ expense: exp, userShare, payerName });
              }}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      <AddEditExpenseModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setExpenseToEdit(null);
        }}
        tripId={tripId}
        members={members}
        currentUser={currentUser}
        expenseToEdit={expenseToEdit}
        onSuccess={() => {
          onRefresh();
          setShowAddModal(false);
          setExpenseToEdit(null);
        }}
      />

      {/* Pay Split Confirmation Modal */}
      {paySplitInfo && (
        <PaySplitConfirmationModal
          isOpen={Boolean(paySplitInfo)}
          onClose={() => setPaySplitInfo(null)}
          tripId={tripId}
          expense={paySplitInfo.expense}
          userShare={paySplitInfo.userShare}
          payerName={paySplitInfo.payerName}
          onSuccess={() => {
            onRefresh();
            setPaySplitInfo(null);
          }}
        />
      )}
    </div>
  );
};
