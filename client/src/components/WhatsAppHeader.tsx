import React, { useState } from 'react';
import { Compass, Search, Bell, User, LogOut, Plus, KeyRound } from 'lucide-react';

interface WhatsAppHeaderProps {
  user: any;
  unreadNotificationsCount?: number;
  onLogout: () => void;
  onOpenCreateTrip: () => void;
  onOpenJoinTrip: () => void;
  onOpenNotifications: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const WhatsAppHeader: React.FC<WhatsAppHeaderProps> = ({
  user,
  unreadNotificationsCount = 0,
  onLogout,
  onOpenCreateTrip,
  onOpenJoinTrip,
  onOpenNotifications,
  searchQuery,
  setSearchQuery,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* App Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight leading-none">TripMate</h1>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">Trip Groups & Expenses</span>
          </div>
        </div>

        {/* Center / Right Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Search Toggle */}
          {showSearchInput ? (
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search trips, members, activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                onBlur={() => {
                  if (!searchQuery) setShowSearchInput(false);
                }}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-full px-3.5 py-1.5 pl-8 w-44 sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
            </div>
          ) : (
            <button
              onClick={() => setShowSearchInput(true)}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-all"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Create & Join Actions */}
          <button
            onClick={onOpenCreateTrip}
            className="p-2 text-slate-300 hover:text-white bg-indigo-600/20 border border-indigo-500/30 rounded-full hover:bg-indigo-600/30 transition-all flex items-center gap-1.5 px-3"
            title="Create Trip"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold hidden sm:inline text-indigo-300">New Trip</span>
          </button>

          <button
            onClick={onOpenJoinTrip}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 border border-slate-700/80 rounded-full hover:bg-slate-700 transition-all hidden sm:flex items-center gap-1.5 px-3"
            title="Join Trip"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Join</span>
          </button>

          {/* Notifications */}
          <button
            onClick={onOpenNotifications}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 relative transition-all"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-indigo-500/50 transition-all"
            >
              <img
                src={user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                alt={user?.name || 'User'}
                className="w-7 h-7 rounded-full object-cover border border-slate-700"
              />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in duration-150">
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="text-xs font-bold text-slate-100 truncate">{user?.name || 'Yaseen'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email || 'yaseen@example.com'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-xl font-medium flex items-center gap-2 mt-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
