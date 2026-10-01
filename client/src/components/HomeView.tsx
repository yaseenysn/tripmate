import React, { useState } from 'react';
import { Plus, KeyRound, Calendar, Users, MapPin, ArrowRight, Compass, CheckCircle } from 'lucide-react';

interface HomeViewProps {
  trips: any[];
  searchQuery: string;
  onOpenTrip: (tripId: string) => void;
  onOpenCreateTrip: () => void;
  onOpenJoinTrip: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  trips,
  searchQuery,
  onOpenTrip,
  onOpenCreateTrip,
  onOpenJoinTrip
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // Filter trips by search query & tab
  const filteredTrips = trips.filter(trip => {
    const matchesSearch = searchQuery === '' || 
      trip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destination.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = activeTab === 'ALL' || trip.status === activeTab;

    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero Quick Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2 z-10 max-w-xl">
          <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full inline-block">
            Collaborative Trip Workspace
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Plan your next journey with friends.
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Split expenses, plan day-by-day itineraries, track budgets, store tickets, and make decision polls together in real time.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 flex-wrap">
          <button
            onClick={onOpenCreateTrip}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Trip</span>
          </button>
          <button
            onClick={onOpenJoinTrip}
            className="bg-slate-800/90 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm px-4 py-3 rounded-2xl border border-slate-700/80 flex items-center gap-2 active:scale-95 transition-all"
          >
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>Join with Code</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {(['ALL', 'ACTIVE', 'UPCOMING', 'COMPLETED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab === 'ALL' ? 'My Trips' : tab}
            </button>
          ))}
        </div>

        <span className="text-xs font-semibold text-slate-500 hidden sm:block">
          Showing {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
        </span>
      </div>

      {/* Trip Cards Grid */}
      {filteredTrips.length === 0 ? (
        <div className="glass-panel p-16 rounded-3xl text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <Compass className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200">No trips found</h3>
            <p className="text-xs text-slate-400 mt-1">Create your first trip or join a friend's workspace.</p>
          </div>
          <button
            onClick={onOpenCreateTrip}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
          >
            + Create Your First Trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map(trip => {
            const startDateStr = new Date(trip.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
            const endDateStr = new Date(trip.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
            const totalBudget = trip.estimatedBudget || 0;
            const totalSpent = trip.totalSpent || 0;
            const spentPct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

            return (
              <div
                key={trip._id}
                onClick={() => onOpenTrip(trip._id)}
                className="glass-card rounded-3xl overflow-hidden cursor-pointer group flex flex-col justify-between"
              >
                {/* Cover Image */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={trip.coverImage || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80'}
                    alt={trip.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-md border ${
                      trip.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : trip.status === 'COMPLETED'
                        ? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}>
                      {trip.status}
                    </span>
                  </div>

                  {/* Title & Location on Image */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-xl font-extrabold text-white group-hover:text-indigo-300 transition-colors drop-shadow-md truncate">
                      {trip.name}
                    </h3>
                    <p className="text-xs text-slate-300 flex items-center gap-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      {trip.destination}
                    </p>
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      {startDateStr} – {endDateStr}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-slate-400" />
                      {trip.memberCount || 1} Members
                    </span>
                  </div>

                  {/* Spending Progress */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-slate-400">Spending</span>
                      <span className="font-bold text-slate-200">
                        ₹{totalSpent.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">/ ₹{totalBudget.toLocaleString()}</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${spentPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Open Workspace Action */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                    <span>Open Workspace</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
