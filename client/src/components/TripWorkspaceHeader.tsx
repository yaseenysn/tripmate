import React from 'react';
import { ArrowLeft, Share2, MoreVertical, Search, UserPlus } from 'lucide-react';

interface TripWorkspaceHeaderProps {
  trip: any;
  members: any[];
  isAdmin: boolean;
  onBackMobile: () => void;
  onOpenInvite: () => void;
  onOpenTripInfo: () => void;
  onSearchClick?: () => void;
}

export const TripWorkspaceHeader: React.FC<TripWorkspaceHeaderProps> = ({
  trip,
  members,
  isAdmin,
  onBackMobile,
  onOpenInvite,
  onOpenTripInfo,
  onSearchClick,
}) => {
  const getDestinationEmoji = (dest: string) => {
    const d = (dest || '').toLowerCase();
    if (d.includes('lucknow')) return '🕌';
    if (d.includes('thiruvananthapuram') || d.includes('kerala')) return '🌴';
    if (d.includes('kashmir') || d.includes('gulmarg') || d.includes('srinagar')) return '🏔️';
    if (d.includes('delhi')) return '🏛️';
    return '✈️';
  };

  const emoji = getDestinationEmoji(trip.destination);

  // Extract member names for WhatsApp header secondary text
  const memberNamesText = members.length > 0
    ? members.map((m) => m.user?.name || m.userId?.name || 'Member').join(', ')
    : 'No members';

  return (
    <div className="bg-[#111b21] border-b border-slate-800/80 px-3.5 py-2.5 flex-shrink-0 z-30 flex items-center justify-between gap-3 shadow-md select-none">
      {/* Left Side: Back Arrow (Mobile) + Circular Group Avatar + Group Title & Members */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          onClick={onBackMobile}
          className="p-1.5 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 md:hidden flex-shrink-0 transition-colors"
          title="Back to My Trips"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div
          onClick={onOpenTripInfo}
          className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 group"
        >
          {/* Circular Group Image */}
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden shadow-inner">
            {trip.coverImage ? (
              <img src={trip.coverImage} alt={trip.name} className="w-full h-full object-cover" />
            ) : (
              <span>{emoji}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-slate-100 text-sm sm:text-base group-hover:text-emerald-400 transition-colors truncate">
                {trip.name}
              </h2>
              {isAdmin && (
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex-shrink-0">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate font-normal">
              {members.length} member{members.length !== 1 ? 's' : ''} • <span className="text-slate-400">{memberNamesText}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side Actions: Search, Invite, Group Info Menu */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-800/80 transition-colors"
            title="Search in Chat"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}

        <button
          onClick={onOpenInvite}
          className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full hover:bg-emerald-500/20 transition-all flex items-center gap-1 px-2.5 text-xs font-semibold"
          title="Invite Members"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Invite</span>
        </button>

        <button
          onClick={onOpenTripInfo}
          className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-800/80 transition-colors"
          title="Group Info & Menu"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
