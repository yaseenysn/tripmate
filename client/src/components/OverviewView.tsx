import React from 'react';
import { Calendar, Users, IndianRupee, Clock, CheckSquare, Activity as ActivityIcon, ArrowRight, Wallet } from 'lucide-react';

interface OverviewViewProps {
  trip: any;
  members: any[];
  budget: any;
  nextItineraryItem?: any;
  pendingTasksCount: number;
  recentActivities: any[];
  onNavigateCategory: (cat: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  trip,
  members,
  budget,
  nextItineraryItem,
  pendingTasksCount,
  recentActivities,
  onNavigateCategory
}) => {
  const totalBudget = trip.estimatedBudget || budget?.totalBudget || 0;
  const totalSpent = trip.totalSpent || 0;
  const percentageSpent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Compact Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Budget Progress Box */}
        <div 
          onClick={() => onNavigateCategory('budget')}
          className="glass-card p-5 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-indigo-400" />
              Budget Progress
            </span>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              {percentageSpent}% Spent
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-100 mb-1">
              ₹{totalSpent.toLocaleString()} <span className="text-sm font-normal text-slate-400">/ ₹{totalBudget.toLocaleString()}</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percentageSpent > 90 ? 'bg-rose-500' : percentageSpent > 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                }`}
                style={{ width: `${percentageSpent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Next Itinerary Card */}
        <div 
          onClick={() => onNavigateCategory('itinerary')}
          className="glass-card p-5 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              Next Activity
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              Itinerary
            </span>
          </div>
          {nextItineraryItem ? (
            <div>
              <p className="font-bold text-slate-100 text-sm truncate">{nextItineraryItem.title}</p>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                Day {nextItineraryItem.dayNumber} • {nextItineraryItem.startTime || 'Scheduled'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No upcoming activity scheduled</p>
          )}
        </div>

        {/* Pending Tasks & Quick Stats */}
        <div 
          onClick={() => onNavigateCategory('tasks')}
          className="glass-card p-5 rounded-2xl cursor-pointer hover:border-amber-500/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              Preparation Tasks
            </span>
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Tasks
            </span>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-100">
              {pendingTasksCount} <span className="text-xs font-normal text-slate-400">pending tasks</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Tap to view task list & assignments</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed Snippet */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-indigo-400" />
            Recent Activity Feed
          </span>
          <button
            onClick={() => onNavigateCategory('activity')}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {recentActivities.slice(0, 4).map((act, i) => (
            <div key={act._id || i} className="flex items-start gap-3 text-xs">
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 flex-shrink-0">
                {act.userId?.avatar ? (
                  <img src={act.userId.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span>{act.userId?.name?.[0] || 'U'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 leading-relaxed">{act.description}</p>
                <span className="text-[10px] text-slate-500">
                  {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {recentActivities.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">No recent activity recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
};
