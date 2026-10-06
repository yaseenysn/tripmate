import React, { useState, useEffect } from 'react';
import { X, Mail, CheckCircle2, Copy, Check, Send, AlertCircle, Share2, Link } from 'lucide-react';
import { apiSendEmailInvite, apiGetInvites, apiCreateInvite } from '../services/api';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
  isAdmin?: boolean;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  tripId,
  tripName,
}) => {
  // Email form state
  const [email, setEmail] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  // Direct Link state
  const [directInvite, setDirectInvite] = useState<any>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch or auto-create direct invite token when modal opens
  const fetchDirectInvite = async () => {
    if (!tripId) return;
    setLinkLoading(true);
    try {
      const data = await apiGetInvites(tripId);
      if (data.invites && data.invites.length > 0) {
        setDirectInvite(data.invites[0]);
      } else {
        const createRes = await apiCreateInvite(tripId);
        setDirectInvite(createRes.invite);
      }
    } catch (err) {
      console.error('Error loading invite link:', err);
    } finally {
      setLinkLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && tripId) {
      setEmail('');
      setCustomMessage('');
      setSuccessMessage('');
      setEmailError('');
      fetchDirectInvite();
    }
  }, [isOpen, tripId]);

  if (!isOpen) return null;

  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailLoading(true);
    setEmailError('');
    setSuccessMessage('');

    try {
      const res = await apiSendEmailInvite(tripId, email.trim(), customMessage.trim());
      setSuccessMessage(res.message || `Invitation sent successfully to ${email.trim()}`);
      setEmail('');
      setCustomMessage('');
    } catch (err: any) {
      setEmailError(err.message || 'Failed to send email invitation');
    } finally {
      setEmailLoading(false);
    }
  };

  const directInviteUrl = directInvite?.inviteUrl || (directInvite?.token ? `${window.location.origin}/join/${directInvite.token}` : '');

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareLink = async () => {
    if (!directInviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${tripName} on TripMate`,
          text: `Hey! Join our trip group "${tripName}" on TripMate:`,
          url: directInviteUrl,
        });
      } catch (err) {
        // User cancelled share dialog
      }
    } else {
      copyToClipboard(directInviteUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-100">Invite Member</h2>
            <p className="text-xs text-slate-400">Invite friends to "{tripName}"</p>
          </div>
        </div>

        {/* Alerts */}
        {emailError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{emailError}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2.5 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 animate-bounce" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* METHOD 1: EMAIL INVITATION */}
        <div className="space-y-4">
          <form onSubmit={handleSendEmailInvite} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email address
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  required
                  placeholder="Enter email address (e.g. bilal@gmail.com)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Personal message <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Hey! Join our trip group on TripMate"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={emailLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
            >
              {emailLoading ? (
                <span className="animate-pulse">Sending Invitation Email...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Invitation</span>
                </>
              )}
            </button>
          </form>

          {/* DIVIDER */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Or share invite link
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* METHOD 2: DIRECT INVITE LINK */}
          <div className="space-y-2.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Link className="w-3.5 h-3.5 text-emerald-400" />
                Direct Invite Link
              </span>
              {directInvite?.code && (
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  Code: {directInvite.code}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={linkLoading ? 'Generating link...' : directInviteUrl}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(directInviteUrl)}
                disabled={!directInviteUrl}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                title="Copy Link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareLink}
                disabled={!directInviteUrl}
                className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                title="Share Link"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
