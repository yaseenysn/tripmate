import React, { useState } from 'react';
import { Plus, X, Receipt, Calendar, Ticket, CheckSquare, Vote, FileText } from 'lucide-react';

interface QuickActionFabProps {
  onSelectAction: (actionType: 'EXPENSE' | 'ITINERARY' | 'BOOKING' | 'TASK' | 'POLL' | 'DOCUMENT') => void;
}

export const QuickActionFab: React.FC<QuickActionFabProps> = ({ onSelectAction }) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { type: 'EXPENSE' as const, label: 'Add Expense', icon: Receipt, color: 'bg-emerald-600 hover:bg-emerald-500' },
    { type: 'ITINERARY' as const, label: 'Add Itinerary', icon: Calendar, color: 'bg-indigo-600 hover:bg-indigo-500' },
    { type: 'BOOKING' as const, label: 'Add Booking', icon: Ticket, color: 'bg-blue-600 hover:bg-blue-500' },
    { type: 'TASK' as const, label: 'Add Task', icon: CheckSquare, color: 'bg-amber-600 hover:bg-amber-500' },
    { type: 'POLL' as const, label: 'Create Poll', icon: Vote, color: 'bg-purple-600 hover:bg-purple-500' },
    { type: 'DOCUMENT' as const, label: 'Upload Document', icon: FileText, color: 'bg-rose-600 hover:bg-rose-500' },
  ];

  const handleTrigger = (type: 'EXPENSE' | 'ITINERARY' | 'BOOKING' | 'TASK' | 'POLL' | 'DOCUMENT') => {
    setIsOpen(false);
    onSelectAction(type);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Expanded Quick Action Items */}
      {isOpen && (
        <div className="mb-3 space-y-2.5 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="bg-slate-900/95 border border-slate-800 p-2.5 rounded-2xl shadow-2xl backdrop-blur-md space-y-1.5 w-48">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-2 block mb-1">
              Add to Trip
            </span>
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.type}
                  onClick={() => handleTrigger(act.type)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all text-left"
                >
                  <div className={`p-1.5 rounded-lg text-white ${act.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span>{act.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 transform active:scale-95 ${
          isOpen ? 'bg-rose-600 rotate-45 shadow-rose-600/40' : 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-indigo-600/50 hover:scale-105'
        }`}
        title="Add to Trip"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
};
