import React from 'react';
import { 
  Home, DollarSign, Wallet, Calendar, Ticket, Users, 
  ArrowLeftRight, CheckSquare, Vote, FileText, Activity 
} from 'lucide-react';

export interface CategoryItem {
  id: string;
  name: string;
  icon: any;
  color: string;
  badge?: string | number;
}

interface TripCategoryNavProps {
  activeCategory: string;
  onSelectCategory: (catId: string) => void;
  pendingTasksCount?: number;
  unvotedPollsCount?: number;
}

export const CATEGORIES: CategoryItem[] = [
  { id: 'overview', name: 'Overview', icon: Home, color: 'text-indigo-400' },
  { id: 'expenses', name: 'Expenses', icon: DollarSign, color: 'text-emerald-400' },
  { id: 'budget', name: 'Budget', icon: Wallet, color: 'text-amber-400' },
  { id: 'itinerary', name: 'Itinerary', icon: Calendar, color: 'text-cyan-400' },
  { id: 'bookings', name: 'Bookings', icon: Ticket, color: 'text-violet-400' },
  { id: 'members', name: 'Members', icon: Users, color: 'text-pink-400' },
  { id: 'settlements', name: 'Settlements', icon: ArrowLeftRight, color: 'text-teal-400' },
  { id: 'tasks', name: 'Tasks', icon: CheckSquare, color: 'text-orange-400' },
  { id: 'polls', name: 'Polls', icon: Vote, color: 'text-rose-400' },
  { id: 'documents', name: 'Documents', icon: FileText, color: 'text-blue-400' },
  { id: 'activity', name: 'Activity', icon: Activity, color: 'text-purple-400' }
];

export const TripCategoryNav: React.FC<TripCategoryNavProps> = ({
  activeCategory,
  onSelectCategory,
  pendingTasksCount,
  unvotedPollsCount
}) => {
  return (
    <div className="mb-6 overflow-x-auto no-scrollbar py-1">
      <div className="flex items-center gap-2 min-w-max">
        {CATEGORIES.map((cat) => {
          const IconComp = cat.icon;
          const isActive = activeCategory === cat.id;

          let badgeVal = undefined;
          if (cat.id === 'tasks' && pendingTasksCount && pendingTasksCount > 0) {
            badgeVal = pendingTasksCount;
          }

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30 scale-105'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
            >
              <IconComp className={`w-4 h-4 ${isActive ? 'text-white' : cat.color}`} />
              <span>{cat.name}</span>
              {badgeVal !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-extrabold">
                  {badgeVal}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
