import React, { useState } from 'react';
import { Wallet, AlertTriangle, TrendingUp, PieChart as PieIcon, Edit3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { apiUpdateBudget } from '../services/api';

interface BudgetViewProps {
  tripId: string;
  budgetData: any;
  onRefresh: () => void;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

export const BudgetView: React.FC<BudgetViewProps> = ({
  tripId,
  budgetData,
  onRefresh
}) => {
  const [showEditTotal, setShowEditTotal] = useState(false);
  const [newTotalBudget, setNewTotalBudget] = useState(budgetData?.totalBudget || 50000);
  const [loading, setLoading] = useState(false);

  const totalBudget = budgetData?.totalBudget || 0;
  const totalSpent = budgetData?.totalSpent || 0;
  const remaining = budgetData?.totalRemaining || (totalBudget - totalSpent);
  const percentage = budgetData?.percentageUsed || (totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0);
  const categories = budgetData?.categories || [];

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiUpdateBudget(tripId, { totalBudget: Number(newTotalBudget) });
      setShowEditTotal(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = categories.map((cat: any) => ({
    name: cat.category,
    Planned: cat.plannedAmount,
    Spent: cat.spentAmount
  }));

  const pieData = categories.filter((c: any) => c.spentAmount > 0).map((cat: any) => ({
    name: cat.category,
    value: cat.spentAmount
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Total Budget
            </span>
            <span className="text-2xl font-extrabold text-slate-100">
              ₹{totalBudget.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => setShowEditTotal(true)}
            className="p-2 rounded-xl bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-all"
            title="Edit Total Budget"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Spent
          </span>
          <span className="text-2xl font-extrabold text-indigo-400">
            ₹{totalSpent.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            {percentage}% of total budget
          </span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Remaining Budget
          </span>
          <span className={`text-2xl font-extrabold ${remaining < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            ₹{remaining.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            {remaining < 0 ? 'Budget Exceeded!' : 'Available for remaining trip'}
          </span>
        </div>
      </div>

      {/* Visual Recharts Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Planned vs Actual */}
        <div className="glass-panel p-5 rounded-3xl">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Planned vs Actual Spending per Category
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="Planned" fill="#334155" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Spent" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category breakdown table */}
        <div className="glass-panel p-5 rounded-3xl space-y-3">
          <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-400" />
            Category Budget Breakdown
          </h3>
          <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto pr-1">
            {categories.map((cat: any, i: number) => (
              <div key={cat.category} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="font-semibold text-slate-200">{cat.category}</span>
                  {cat.isExceeded && (
                    <span className="text-[10px] bg-rose-500/20 text-rose-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Exceeded
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="font-bold text-slate-100 block">
                    ₹{cat.spentAmount.toLocaleString()} <span className="text-slate-500 font-normal">/ ₹{cat.plannedAmount.toLocaleString()}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {cat.percentage}% used
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Budget Modal */}
      {showEditTotal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Edit Total Budget</h3>
            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Budget Amount (₹)
                </label>
                <input
                  type="number"
                  value={newTotalBudget}
                  onChange={(e) => setNewTotalBudget(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditTotal(false)}
                  className="flex-1 bg-slate-800 text-slate-300 text-xs font-semibold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
