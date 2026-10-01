import React from 'react';
import { Activity as ActivityIcon, Clock } from 'lucide-react';

interface ActivityViewProps {
  activities: any[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({ activities }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-panel p-6 rounded-3xl">
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
          Trip Collaboration Audit Log
        </span>
        <h2 className="text-xl font-bold text-slate-100">Live Activity Feed</h2>
      </div>

      <div className="glass-panel p-6 rounded-3xl">
        {activities.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No activity recorded yet.</p>
        ) : (
          <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
            {activities.map((act, idx) => (
              <div key={act._id || idx} className="relative group">
                {/* Timeline dot */}
                <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-500 ring-4 ring-slate-900 shadow-md shadow-indigo-500/50" />

                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-indigo-300">
                      {act.userId?.name || 'User'}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(act.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
