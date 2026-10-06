import React from 'react';
import { Plus, KeyRound, Search, Compass, Users, Clock, ShieldCheck } from 'lucide-react';

interface TripListViewProps {
  trips: any[];
  activeTripId: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectTrip: (tripId: string) => void;
  onOpenCreateTrip: () => void;
  onOpenJoinTrip: () => void;
}

export const TripListView: React.FC<TripListViewProps> = ({
  trips,
  activeTripId,
  searchQuery,
  setSearchQuery,
  onSelectTrip,
  onOpenCreateTrip,
  onOpenJoinTrip,
}) => {
  // Filter trips by search query
  const filteredTrips = trips.filter((trip) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      trip.name?.toLowerCase().includes(q) ||
      trip.destination?.toLowerCase().includes(q) ||
      trip.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900 border-r border-slate-800/80 select-none">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-800/80 flex-shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search trips or destinations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
        </div>
      </div>

      {/* Action Buttons Header */}
      <div className="px-3 py-2 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider flex-shrink-0">
        <span>My Trips ({filteredTrips.length})</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenJoinTrip}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 normal-case font-medium bg-slate-800 px-2.5 py-1 rounded-lg"
          >
            <KeyRound className="w-3 h-3 text-indigo-400" />
            <span>Join</span>
          </button>
          <button
            onClick={onOpenCreateTrip}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 normal-case font-medium bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Trip Rows (WhatsApp Chat List Style) */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/40">
        {filteredTrips.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Compass className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
            <div>
              <p className="text-sm font-bold text-slate-300">No trips found</p>
              <p className="text-xs text-slate-500 mt-1">Start your trip group with friends.</p>
            </div>
            <button
              onClick={onOpenCreateTrip}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
            >
              + Create Trip
            </button>
          </div>
        ) : (
          filteredTrips.map((trip) => {
            const isSelected = trip._id === activeTripId;
            const startDateStr = new Date(trip.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
            const endDateStr = new Date(trip.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' });

            // Emoji / Image Avatar based on trip destination
            const getDestinationEmoji = (dest: string) => {
              const d = (dest || '').toLowerCase();
              if (d.includes('lucknow')) return '🕌';
              if (d.includes('thiruvananthapuram') || d.includes('kerala')) return '🌴';
              if (d.includes('kashmir') || d.includes('gulmarg') || d.includes('srinagar')) return '🏔️';
              if (d.includes('delhi')) return '🏛️';
              return '✈️';
            };

            const emoji = getDestinationEmoji(trip.destination);
            const latestActivityText = trip.lastActivityText || `Created ${startDateStr} – ${endDateStr}`;

            return (
              <div
                key={trip._id}
                onClick={() => onSelectTrip(trip._id)}
                className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border-l-4 border-indigo-500'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                {/* Small WhatsApp-style Circular Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl overflow-hidden shadow-inner">
                    {trip.coverImage ? (
                      <img src={trip.coverImage} alt={trip.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{emoji}</span>
                    )}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                      trip.status === 'ACTIVE'
                        ? 'bg-emerald-500'
                        : trip.status === 'COMPLETED'
                        ? 'bg-slate-500'
                        : 'bg-indigo-500'
                    }`}
                  />
                </div>

                {/* Main Row Information */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-300' : 'text-slate-100'}`}>
                      {trip.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium flex-shrink-0 ml-1">
                      {startDateStr}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <p className="truncate text-slate-300 font-normal text-[11px]">
                      {latestActivityText}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded-md flex-shrink-0 ml-1 border border-slate-700/50">
                      {trip.memberCount || 1} members
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
