import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, Share2, Plus, AlertCircle } from 'lucide-react';
import { apiGetInvites, apiCreateInvite, apiRevokeInvite } from '../services/api';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
  isAdmin: boolean;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  tripId,
  tripName,
  isAdmin
}) => {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<any | null>(null);

  const fetchInvites = async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const data = await apiGetInvites(tripId);
      setInvites(data.invites || []);
      if (data.invites && data.invites.length > 0) {
        setSelectedInvite(data.invites[0]);
      } else if (isAdmin) {
        // Auto-generate invite if none exists
        handleCreateInvite();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && tripId) {
      fetchInvites();
    }
  }, [isOpen, tripId]);

  const handleCreateInvite = async () => {
    setLoading(true);
    try {
      const data = await apiCreateInvite(tripId);
      setInvites(prev => [data.invite, ...prev]);
      setSelectedInvite(data.invite);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await apiRevokeInvite(tripId, inviteId);
      setInvites(prev => prev.filter(i => i._id !== inviteId));
      if (selectedInvite?._id === inviteId) {
        setSelectedInvite(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Invite Members</h2>
            <p className="text-xs text-slate-400">Invite friends to "{tripName}"</p>
          </div>
        </div>

        {selectedInvite ? (
          <div className="space-y-5">
            {/* Invite Code Box */}
            <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-1">
                Trip Invite Code
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-extrabold font-mono text-indigo-400 tracking-wider">
                  {selectedInvite.code}
                </span>
                <button
                  onClick={() => copyToClipboard(selectedInvite.code, false)}
                  className="p-2 rounded-xl bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-all"
                  title="Copy code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* QR Code */}
            {selectedInvite.qrCodeDataUrl && (
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl">
                <div className="p-3 bg-white rounded-2xl shadow-lg mb-2">
                  <img
                    src={selectedInvite.qrCodeDataUrl}
                    alt="Trip QR Code"
                    className="w-36 h-36"
                  />
                </div>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5" />
                  Scan to Join Workspace
                </span>
              </div>
            )}

            {/* Share Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Invite Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={selectedInvite.inviteUrl || `${window.location.origin}/join/${selectedInvite.token}`}
                  className="flex-1 bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(selectedInvite.inviteUrl || `${window.location.origin}/join/${selectedInvite.token}`, true)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Admin options */}
            {isAdmin && (
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <button
                  onClick={handleCreateInvite}
                  disabled={loading}
                  className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Link
                </button>
                <button
                  onClick={() => handleRevoke(selectedInvite._id)}
                  className="text-rose-400 hover:text-rose-300 font-medium"
                >
                  Revoke Invite
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm">No active invites for this trip.</p>
            {isAdmin && (
              <button
                onClick={handleCreateInvite}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-xl hover:bg-indigo-500 transition-all"
              >
                Generate Invite Link & Code
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
