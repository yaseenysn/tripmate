import React from 'react';
import {
  X, Calendar, MapPin, Users, Share2, Wallet, Ticket, FileText,
  CheckSquare, Vote, Activity, Settings, Trash2, ChevronRight, Image as ImageIcon,
  DollarSign, CheckCircle2, Lock, Clock, ShieldCheck
} from 'lucide-react';

interface TripInfoDrawerProps {
  trip: any;
  members: any[];
  budget: any;
  isAdmin: boolean;
  currentUser: any;
  isOpen: boolean;
  onClose: () => void;
  onOpenInvite: () => void;
  onNavigateCategory: (cat: string) => void;
  onDeleteTrip?: () => void;
  onOpenTripReport: () => void;
  onOpenFinishConfirmation?: () => void;
}

export const TripInfoDrawer: React.FC<TripInfoDrawerProps> = ({
  trip,
  members,
  budget,
  isAdmin,
  currentUser,
  isOpen,
  onClose,
  onOpenInvite,
  onNavigateCategory,
  onDeleteTrip,
  onOpenTripReport,
  onOpenFinishConfirmation,
}) => {
  if (!isOpen || !trip) return null;

  const totalBudget = trip.estimatedBudget || budget?.totalBudget || 0;
  const totalSpent = trip.totalSpent || 0;
  const remaining = totalBudget - totalSpent;
  const startDateStr = new Date(trip.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const endDateStr = new Date(trip.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const isClosed = trip.status === 'CLOSED';
  const isSettled = trip.status === 'SETTLED' || trip.settlementStatus === 'SETTLED';
  const isCompleted = trip.status === 'COMPLETED' || isSettled || isClosed;

  const featureSections = [
    { cat: 'documents', label: 'Media, Links & Documents', icon: ImageIcon, color: 'text-cyan-400' },
    { cat: 'itinerary', label: 'Itinerary', icon: Calendar, color: 'text-blue-400' },
    { cat: 'bookings', label: 'Bookings', icon: Ticket, color: 'text-amber-400' },
    { cat: 'expenses', label: 'Expenses', icon: DollarSign, color: 'text-emerald-400' },
    { cat: 'settlements', label: 'Settlements', icon: Wallet, color: 'text-teal-400' },
    { cat: 'tasks', label: 'Tasks', icon: CheckSquare, color: 'text-purple-400' },
    { cat: 'polls', label: 'Polls', icon: Vote, color: 'text-rose-400' },
    { cat: 'activity', label: 'Activity', icon: Activity, color: 'text-slate-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111b21] border-l border-slate-800 w-full max-w-md h-full flex flex-col overflow-y-auto shadow-2xl">
        {/* Top Header Bar */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between sticky top-0 bg-[#111b21]/95 backdrop-blur-md z-10">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Group Info</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cover Image & Group Header */}
        <div className="relative h-48 overflow-hidden bg-slate-950 flex-shrink-0">
          <img
            src={trip.coverImage || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80'}
            alt={trip.name}
            className="w-full h-full object-cover filter brightness-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111b21] via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isClosed
                    ? 'bg-slate-800/90 text-slate-300 border-slate-600'
                    : isSettled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : isCompleted
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {trip.status || 'ACTIVE'}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">{trip.name}</h2>
            <p className="text-xs text-slate-300 flex items-center gap-2 mt-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{trip.destination} • {startDateStr} – {endDateStr}</span>
            </p>
            <p className="text-xs text-emerald-400 font-semibold mt-0.5">
              Group • {members.length} members
            </p>
          </div>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* Trip Summary & Settlement Report Action Button */}
          <button
            onClick={() => {
              onOpenTripReport();
              onClose();
            }}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-between shadow-lg shadow-emerald-600/20 transition-all group"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xs font-extrabold block">Trip Summary & Final Report</span>
                <span className="text-[10px] text-emerald-100">
                  View full financial summary, balances & download PDF
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-100 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Budget KPI Card */}
          <div className="bg-[#1f2c34] p-4 rounded-2xl border border-slate-700/60 space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Trip Budget</span>
            <div className="text-2xl font-extrabold text-white">
              ₹{totalBudget.toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Spent</span>
                <span className="font-bold text-emerald-400">₹{totalSpent.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Remaining</span>
                <span className={`font-bold ${remaining < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                  ₹{remaining.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-[#1f2c34] p-4 rounded-2xl border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {members.length} Members
              </span>
              {!isClosed && (
                <button
                  onClick={onOpenInvite}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Invite</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto">
              {members.map((m) => {
                const u = m.user || m.userId || {};
                const isUserAdmin = m.role === 'ADMIN';

                return (
                  <div key={m._id || u._id} className="flex items-center justify-between p-2 rounded-xl bg-[#111b21] border border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-100">{u.name || 'Member'}</p>
                        <p className="text-[10px] text-slate-400">{u.email}</p>
                      </div>
                    </div>

                    {isUserAdmin && (
                      <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ADMIN
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* WhatsApp Group Navigation Links */}
          <div className="bg-[#1f2c34] p-3 rounded-2xl border border-slate-700/60 divide-y divide-slate-700/60">
            {featureSections.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.cat}
                  onClick={() => {
                    onNavigateCategory(item.cat);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between py-3 px-1 text-xs text-slate-200 hover:text-white transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="font-semibold">{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </button>
              );
            })}

            {!isClosed && (
              <button
                onClick={onOpenInvite}
                className="w-full flex items-center justify-between py-3 px-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors text-left font-bold"
              >
                <div className="flex items-center gap-3">
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>Invite Members</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>

          {/* Admin Trip Lifecycle Action */}
          {isAdmin && !isClosed && (
            <div className="p-3 bg-[#1f2c34] rounded-2xl border border-slate-700/60 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Trip Lifecycle
              </span>
              {!isCompleted ? (
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenFinishConfirmation) onOpenFinishConfirmation();
                  }}
                  className="w-full py-2.5 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold rounded-xl border border-indigo-500/30 flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  <span>Finish Trip</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    onOpenTripReport();
                  }}
                  className="w-full py-2.5 px-3 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-xs font-bold rounded-xl border border-teal-500/30 flex items-center justify-center gap-2 transition-all"
                >
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span>Review Final Report & Settle</span>
                </button>
              )}
            </div>
          )}

          {/* Delete / Danger Zone */}
          {isAdmin && !isClosed && onDeleteTrip && (
            <div className="pt-2">
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${trip.name}"?`)) {
                    onDeleteTrip();
                    onClose();
                  }
                }}
                className="w-full py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-2xl border border-rose-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Trip Group</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
