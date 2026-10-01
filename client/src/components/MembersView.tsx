import React from 'react';
import { Users, Shield, User, UserMinus, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { apiRemoveMember, apiUpdateMemberRole } from '../services/api';

interface MembersViewProps {
  tripId: string;
  members: any[];
  isAdmin: boolean;
  currentUser: any;
  onOpenInvite: () => void;
  onRefresh: () => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  tripId,
  members,
  isAdmin,
  currentUser,
  onOpenInvite,
  onRefresh
}) => {
  const handleRemove = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from this trip?`)) return;
    try {
      await apiRemoveMember(tripId, memberId);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    try {
      await apiUpdateMemberRole(tripId, memberId, newRole);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-panel p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
            Trip Workspace Members
          </span>
          <h2 className="text-xl font-bold text-slate-100">{members.length} Active Members</h2>
        </div>

        <button
          onClick={onOpenInvite}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Invite Member</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {members.map(m => {
          const u = m.user || m.userId;
          const isSelf = u?._id === currentUser?._id;
          const net = m.netBalance || 0;

          return (
            <div key={m._id} className="glass-card p-5 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={u?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'}
                  alt={u?.name}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-indigo-500/30 flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-100 text-sm truncate">
                      {u?.name} {isSelf && '(You)'}
                    </h4>
                    {m.role === 'ADMIN' && (
                      <span className="text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-500/30">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{u?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`text-xs font-bold block ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {net > 0 ? `+₹${net.toLocaleString()}` : net < 0 ? `-₹${Math.abs(net).toLocaleString()}` : 'Settled'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Paid: ₹{(m.amountPaid || 0).toLocaleString()}
                  </span>
                </div>

                {isAdmin && !isSelf && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleRole(m._id, m.role)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-all text-xs"
                      title="Toggle Admin role"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(m._id, u?.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all text-xs"
                      title="Remove member"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
