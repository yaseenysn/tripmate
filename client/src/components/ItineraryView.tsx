import React, { useState } from 'react';
import { Calendar, Plus, Clock, MapPin, IndianRupee, Trash2, CheckCircle2 } from 'lucide-react';
import { apiCreateItineraryItem, apiDeleteItineraryItem } from '../services/api';

interface ItineraryViewProps {
  tripId: string;
  items: any[];
  members: any[];
  openAddModal?: boolean;
  onRefresh: () => void;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({
  tripId,
  items,
  members,
  openAddModal = false,
  onRefresh
}) => {
  const [showAddModal, setShowAddModal] = useState(openAddModal);

  React.useEffect(() => {
    if (openAddModal) setShowAddModal(true);
  }, [openAddModal]);
  const [dayNumber, setDayNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [loading, setLoading] = useState(false);

  // Group items by day number
  const daysMap: Record<number, any[]> = {};
  items.forEach(item => {
    const d = item.dayNumber || 1;
    if (!daysMap[d]) daysMap[d] = [];
    daysMap[d].push(item);
  });

  const sortedDays = Object.keys(daysMap).map(Number).sort((a, b) => a - b);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;

    setLoading(true);
    try {
      await apiCreateItineraryItem(tripId, {
        dayNumber: Number(dayNumber),
        title,
        date,
        startTime,
        endTime,
        location,
        description,
        estimatedCost: Number(estimatedCost) || 0
      });
      setShowAddModal(false);
      setTitle('');
      setLocation('');
      setDescription('');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this itinerary item?')) return;
    try {
      await apiDeleteItineraryItem(tripId, id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
            Day-by-Day Itinerary
          </span>
          <h2 className="text-xl font-bold text-slate-100">Travel Plan & Timeline</h2>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Plan</span>
        </button>
      </div>

      {/* Timeline List */}
      {sortedDays.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">Your itinerary is empty</h3>
          <p className="text-xs text-slate-500 mt-1">Plan your first day of the trip by clicking "+ Add Plan".</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDays.map(dayNum => (
            <div key={dayNum} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold rounded-xl">
                  DAY {dayNum}
                </span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              <div className="space-y-3 pl-2 border-l-2 border-indigo-500/30 ml-4">
                {daysMap[dayNum].map(item => (
                  <div
                    key={item._id}
                    className="glass-card p-4 rounded-2xl relative ml-3 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                        </span>
                        {item.location && (
                          <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                            <MapPin className="w-3.5 h-3.5 text-rose-400" />
                            {item.location}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-100 text-sm">{item.title}</h4>
                      {item.description && (
                        <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
                      )}

                      {item.estimatedCost > 0 && (
                        <span className="inline-block text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          Est. Cost: ₹{item.estimatedCost.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteItem(item._id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Add Itinerary Plan</h3>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Day Number *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={dayNumber}
                    onChange={(e) => setDayNumber(Number(e.target.value))}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Activity Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Visit Bara Imambara"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
                    placeholder="10:00 AM"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chowk, Lucknow"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes or details about this activity..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 text-slate-300 text-xs font-semibold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
