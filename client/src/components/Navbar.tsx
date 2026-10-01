import React, { useState, useEffect } from 'react';
import { Compass, Search, Bell, Plus, User as UserIcon, LogOut, KeyRound, CheckCircle } from 'lucide-react';
import { apiGetNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead } from '../services/api';

interface NavbarProps {
  user: any;
  onLogout: () => void;
  onOpenCreateTrip: () => void;
  onOpenJoinTrip: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onOpenCreateTrip,
  onOpenJoinTrip,
  searchQuery,
  setSearchQuery,
  onNavigateHome
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const fetchNotifs = async () => {
    if (!user) return;
    try {
      const data = await apiGetNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkRead = async (id: string) => {
    try {
      await apiMarkNotificationRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div 
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Compass className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              Trip<span className="text-indigo-400">Mate</span>
            </span>
            <span className="hidden sm:block text-[10px] uppercase font-bold tracking-widest text-indigo-400/80 -mt-1">
              Collaborative Travel Workspace
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search trip names, destinations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 text-slate-100 placeholder-slate-400 text-sm rounded-full pl-10 pr-4 py-2 border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Action Buttons & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Create Trip */}
          <button
            onClick={onOpenCreateTrip}
            className="hidden sm:flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Trip</span>
          </button>

          {/* Quick Join Code */}
          <button
            onClick={onOpenJoinTrip}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-200 font-medium text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-700/80 active:scale-95 transition-all"
          >
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">Join Code</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
              className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-all"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900 animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="p-3.5 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-200">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n._id}
                        onClick={() => handleMarkRead(n._id)}
                        className={`p-3.5 hover:bg-slate-800/50 cursor-pointer transition-colors ${!n.isRead ? 'bg-indigo-950/20' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-xs text-indigo-300">{n.title}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
              className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all"
            >
              <img
                src={user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'}
                alt={user?.name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-500/40"
              />
              <span className="hidden sm:inline font-medium text-xs text-slate-200">{user?.name}</span>
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2">
                <div className="p-3 border-b border-slate-800 mb-1">
                  <p className="font-semibold text-sm text-slate-100">{user?.name}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
