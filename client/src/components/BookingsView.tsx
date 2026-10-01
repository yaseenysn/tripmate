import React, { useState } from 'react';
import { Ticket, Plus, Plane, Train, Bus, Building, Car, Activity, FileText, Trash2 } from 'lucide-react';
import { apiCreateBooking, apiDeleteBooking } from '../services/api';

interface BookingsViewProps {
  tripId: string;
  bookings: any[];
  openAddModal?: boolean;
  onRefresh: () => void;
}

const BOOKING_TYPES = [
  { type: 'FLIGHT', label: 'Flight', icon: Plane },
  { type: 'TRAIN', label: 'Train', icon: Train },
  { type: 'BUS', label: 'Bus', icon: Bus },
  { type: 'HOTEL', label: 'Hotel', icon: Building },
  { type: 'CAB', label: 'Cab', icon: Car },
  { type: 'ACTIVITY', label: 'Activity', icon: Activity }
];

export const BookingsView: React.FC<BookingsViewProps> = ({
  tripId,
  bookings,
  openAddModal = false,
  onRefresh
}) => {
  const [showAddModal, setShowAddModal] = useState(openAddModal);

  React.useEffect(() => {
    if (openAddModal) setShowAddModal(true);
  }, [openAddModal]);
  const [type, setType] = useState('HOTEL');
  const [provider, setProvider] = useState('');
  const [bookingReference, setBookingReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !date) return;

    setLoading(true);
    try {
      await apiCreateBooking(tripId, {
        type,
        provider,
        bookingReference,
        date,
        time,
        location,
        cost: Number(cost) || 0,
        notes
      });
      setShowAddModal(false);
      setProvider('');
      setBookingReference('');
      setNotes('');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Delete this booking ticket?')) return;
    try {
      await apiDeleteBooking(tripId, id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const getIconForType = (t: string) => {
    const found = BOOKING_TYPES.find(b => b.type === t);
    const IconComp = found ? found.icon : Ticket;
    return <IconComp className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-panel p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider block mb-1">
            Trip Bookings & Reservations
          </span>
          <h2 className="text-xl font-bold text-slate-100">Tickets & Confirmations</h2>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-600/20 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Booking</span>
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">No bookings recorded yet</h3>
          <p className="text-xs text-slate-500 mt-1">Keep flights, hotels, and train tickets organized in one place.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookings.map(b => (
            <div key={b._id} className="glass-card p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                      {getIconForType(b.type)}
                    </div>
                    <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                      {b.type}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteBooking(b._id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="font-bold text-slate-100 text-base">{b.provider}</h4>
                {b.bookingReference && (
                  <p className="text-xs text-indigo-300 font-mono mt-0.5">Ref: {b.bookingReference}</p>
                )}

                <div className="mt-3 text-xs text-slate-400 space-y-1">
                  <p>Date: {new Date(b.date).toLocaleDateString()} {b.time ? `• ${b.time}` : ''}</p>
                  {b.location && <p>Location: {b.location}</p>}
                </div>
              </div>

              {b.cost > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Cost</span>
                  <span className="font-extrabold text-slate-100 text-sm">₹{b.cost.toLocaleString()}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Add Booking</h3>
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                >
                  {BOOKING_TYPES.map(bt => (
                    <option key={bt.type} value={bt.type}>{bt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Provider / Service Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. IndiGo Airlines, Taj Hotel"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    PNR / Ref Code
                  </label>
                  <input
                    type="text"
                    placeholder="IND-9921"
                    value={bookingReference}
                    onChange={(e) => setBookingReference(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Cost (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="12000"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Time / Flight No
                  </label>
                  <input
                    type="text"
                    placeholder="06:45 AM"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                  />
                </div>
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
                  className="flex-1 bg-violet-600 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg"
                >
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
