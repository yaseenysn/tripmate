import React, { useState, useEffect } from 'react';
import { Compass, Users, MapPin, Calendar, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { apiPreviewInvite, apiJoinWithToken } from '../services/api';

interface JoinInviteConfirmationModalProps {
  token: string | null;
  currentUser: any;
  onJoined: (tripId: string) => void;
  onCancel: () => void;
}

export const JoinInviteConfirmationModal: React.FC<JoinInviteConfirmationModalProps> = ({
  token,
  currentUser,
  onJoined,
  onCancel
}) => {
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');

    apiPreviewInvite(token)
      .then((data) => {
        setPreviewData(data);
      })
      .catch((err) => {
        setError(err.message || 'Invalid or expired trip invite link');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  if (!token) return null;

  const trip = previewData?.trip;
  const inviter = previewData?.inviter;

  const handleConfirmJoin = async () => {
    setJoining(true);
    setError('');
    try {
      const res = await apiJoinWithToken(token);
      onJoined(res.tripId);
    } catch (err: any) {
      if (err.message && err.message.includes('already a member')) {
        setAlreadyMember(true);
      } else {
        setError(err.message || 'Failed to join trip');
      }
    } finally {
      setJoining(false);
    }
  };

  const getDestinationEmoji = (dest: string) => {
    const d = (dest || '').toLowerCase();
    if (d.includes('lucknow')) return '🕌';
    if (d.includes('thiruvananthapuram') || d.includes('kerala')) return '🌴';
    if (d.includes('kashmir') || d.includes('gulmarg') || d.includes('srinagar')) return '🏔️';
    if (d.includes('delhi')) return '🏛️';
    return '✈️';
  };

  const emoji = trip ? getDestinationEmoji(trip.destination) : '✈️';
  const startDateStr = trip?.startDate ? new Date(trip.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const endDateStr = trip?.endDate ? new Date(trip.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 relative overflow-hidden">
        {/* Top Header Background Banner */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border-b border-slate-800/80 -z-0" />

        <button
          onClick={onCancel}
          className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-900/80 border border-slate-800 hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 pt-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-xs font-semibold">Loading Trip Invitation...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Invitation Error</h3>
                <p className="text-xs text-rose-400 mt-1 max-w-xs mx-auto">{error}</p>
              </div>
              <button
                onClick={onCancel}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Inviter Badge */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-emerald-500/80 flex items-center justify-center text-2xl overflow-hidden shadow-lg flex-shrink-0">
                  {trip.coverImage ? (
                    <img src={trip.coverImage} alt={trip.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{emoji}</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-0.5">
                    Trip Group Invitation
                  </span>
                  <h2 className="text-lg font-black text-slate-100 truncate max-w-[240px]">
                    {trip.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Invited by <strong className="text-slate-200">{inviter?.name || 'A Trip Member'}</strong>
                  </p>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="font-semibold">{trip.destination}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>{startDateStr} – {endDateStr}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>{trip.memberCount || 1} member{trip.memberCount !== 1 ? 's' : ''} in group</span>
                </div>

                {trip.description && (
                  <p className="text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80 italic">
                    "{trip.description}"
                  </p>
                )}
              </div>

              {/* Already Member Notice or Action Buttons */}
              {alreadyMember ? (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                  <p className="text-xs font-bold text-emerald-400">You are already a member of this trip!</p>
                  <button
                    onClick={() => onJoined(trip._id)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Open Trip Workspace
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    Joined members can chat in real time, add & split expenses, and coordinate trip tasks together.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={onCancel}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                    >
                      Decline
                    </button>
                    <button
                      onClick={handleConfirmJoin}
                      disabled={joining}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all"
                    >
                      {joining ? (
                        <span className="animate-pulse">Joining Trip...</span>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Join Trip</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
