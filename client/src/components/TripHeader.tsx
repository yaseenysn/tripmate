import React from 'react';
import { ArrowLeft, Calendar, MapPin, Users, Share2, Settings } from 'lucide-react';

interface TripHeaderProps {
  trip: any;
  members: any[];
  isAdmin: boolean;
  onBack: () => void;
  onOpenInvite: () => void;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  trip,
  members,
  isAdmin,
  onBack,
  onOpenInvite
}) => {
  const startDateStr = new Date(trip.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const endDateStr = new Date(trip.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className="relative rounded-3xl overflow-hidden mb-6 border border-slate-800 shadow-2xl">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={trip.coverImage || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80'}
          alt={trip.name}
          className="w-full h-full object-cover filter brightness-[0.35] blur-[1px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
      </div>

      <div className="relative z-10 p-6 md:p-8 space-y-4">
        {/* Top bar with back button */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-slate-200 hover:text-white border border-slate-700/60 text-xs font-semibold backdrop-blur-md transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>My Trips</span>
          </button>

          <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase backdrop-blur-md border ${
            trip.status === 'ACTIVE'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : trip.status === 'COMPLETED'
              ? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
          }`}>
            {trip.status} TRIP
          </span>
        </div>

        {/* Title & Info */}
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
            {trip.name}
          </h1>
          <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-300 mt-2 flex-wrap font-medium">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-400" />
              {trip.destination}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              {startDateStr} – {endDateStr}
            </span>
          </div>
        </div>

        {/* Members & Invite CTA */}
        <div className="pt-2 flex items-center justify-between gap-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((m, idx) => {
                const u = m.user || m.userId;
                return (
                  <img
                    key={m._id || idx}
                    src={u?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'}
                    alt={u?.name}
                    className="w-8 h-8 rounded-full border-2 border-slate-900 object-cover"
                    title={u?.name}
                  />
                );
              })}
            </div>
            {members.length > 5 && (
              <span className="text-xs text-slate-400 font-semibold pl-1">
                +{members.length - 5} more
              </span>
            )}
          </div>

          <button
            onClick={onOpenInvite}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Invite</span>
          </button>
        </div>
      </div>
    </div>
  );
};
