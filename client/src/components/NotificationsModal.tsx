import React from 'react';
import { Bell, X, Check, Info } from 'lucide-react';

interface NotificationsModalProps {
  notifications: any[];
  isOpen: boolean;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  notifications,
  isOpen,
  onClose,
  onMarkRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-sm h-full flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">Notifications</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Bell className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs">No notifications right now.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                className={`p-3 rounded-2xl border text-xs space-y-1 transition-all ${
                  n.isRead
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                    : 'bg-slate-800/80 border-indigo-500/30 text-slate-100 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{n.title}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
