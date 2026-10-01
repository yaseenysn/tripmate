import React, { useState } from 'react';
import { Wallet, ChevronDown, ChevronUp, Clock, CheckSquare, Users } from 'lucide-react';

interface PinnedTripSummaryProps {
  trip: any;
  budget: any;
  members: any[];
  nextItineraryItem?: any;
  pendingTasksCount: number;
  onOpenTripInfo: () => void;
  onNavigateSection: (sec: string) => void;
}

export const PinnedTripSummary: React.FC<PinnedTripSummaryProps> = ({
  trip,
  budget,
  members,
  nextItineraryItem,
  pendingTasksCount,
  onOpenTripInfo,
  onNavigateSection,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalBudget = trip.estimatedBudget || budget?.totalBudget || 0;
  const totalSpent = trip.totalSpent || 0;
  const remaining = totalBudget - totalSpent;
  const percentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 sticky top-14 z-20 transition-all shadow-md">
      {isCollapsed ? (
        /* Collapsed Single Compact Bar */
        <div className="flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">
              ₹{totalSpent.toLocaleString()} spent of ₹{totalBudget.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">({percentage}%)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenTripInfo}
              className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:underline"
            >
              Trip Info
            </button>
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Full Compact Pinned Summary */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                Pinned Summary
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {trip.destination} • {members.length} members
              </span>
            </div>

            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Collapse Summary"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Budget & Key Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <div
              onClick={() => onNavigateSection('budget')}
              className="cursor-pointer hover:bg-slate-800/60 p-1 rounded-lg transition-all"
            >
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Budget</span>
              <span className="text-xs font-extrabold text-slate-200">₹{totalBudget.toLocaleString()}</span>
            </div>

            <div
              onClick={() => onNavigateSection('expenses')}
              className="cursor-pointer hover:bg-slate-800/60 p-1 rounded-lg transition-all border-x border-slate-800"
            >
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Spent</span>
              <span className="text-xs font-extrabold text-indigo-400">₹{totalSpent.toLocaleString()}</span>
            </div>

            <div
              onClick={() => onNavigateSection('budget')}
              className="cursor-pointer hover:bg-slate-800/60 p-1 rounded-lg transition-all"
            >
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Remaining</span>
              <span className={`text-xs font-extrabold ${remaining < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                ₹{remaining.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Progress Bar & Sub Previews */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  percentage > 90 ? 'bg-rose-500' : percentage > 75 ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              {nextItineraryItem ? (
                <span
                  onClick={() => onNavigateSection('itinerary')}
                  className="cursor-pointer hover:text-slate-200 truncate flex items-center gap-1 max-w-[200px]"
                >
                  <Clock className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">Next: {nextItineraryItem.title}</span>
                </span>
              ) : (
                <span className="text-slate-500 italic">No upcoming activity</span>
              )}

              <span
                onClick={() => onNavigateSection('tasks')}
                className="cursor-pointer hover:text-slate-200 flex items-center gap-1 flex-shrink-0"
              >
                <CheckSquare className="w-3 h-3 text-amber-400" />
                <span>{pendingTasksCount} tasks pending</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
