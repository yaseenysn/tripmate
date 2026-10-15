import React, { useState, useEffect } from 'react';
import { Compass, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiLogin, apiRegister, apiPreviewInvite, setAuthToken } from '../services/api';

interface AuthViewProps {
  onAuthSuccess: (user: any, token: string) => void;
  inviteToken?: string | null;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess, inviteToken }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Invite preview state
  const [invitePreview, setInvitePreview] = useState<any>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (inviteToken) {
      setInviteError(null);
      apiPreviewInvite(inviteToken)
        .then((data) => {
          setInvitePreview(data);
          if (data?.invite?.invitedEmail) {
            setLoginEmail(data.invite.invitedEmail);
            setRegEmail(data.invite.invitedEmail);
          }
          // Default to registration so invitee can create their account seamlessly
          setMode('REGISTER');
        })
        .catch((err) => {
          setInviteError(err.message || 'Invalid or expired invitation link');
        });
    }
  }, [inviteToken]);

  const formatAuthError = (err: any, defaultMsg: string) => {
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError') || err?.message?.includes('fetch failed')) {
      return 'Unable to connect to backend server. Please verify the server is running on http://localhost:5000.';
    }
    return err?.message || defaultMsg;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail || !loginPassword) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiLogin(loginEmail.trim(), loginPassword);
      if (res.token && res.user) {
        setAuthToken(res.token);
        onAuthSuccess(res.user, res.token);
      } else {
        setError('Invalid response from server.');
      }
    } catch (err: any) {
      setError(formatAuthError(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regName || !regEmail || !regPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRegister(regName.trim(), regEmail.trim(), regPassword);
      if (res.token && res.user) {
        setAuthToken(res.token);
        onAuthSuccess(res.user, res.token);
      } else {
        setError('Failed to create account.');
      }
    } catch (err: any) {
      setError(formatAuthError(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 select-none font-sans">
      <div className="max-w-md w-full space-y-6 animate-in fade-in duration-300">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30 mx-auto">
            <Compass className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">TripMate</h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            {invitePreview
              ? `You've been invited to join ${invitePreview.trip?.name || 'a trip'}!`
              : mode === 'LOGIN'
              ? 'Log in to your trip workspace'
              : 'Create an account to start planning trips'}
          </p>
        </div>

        {/* Auth Card Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Invitation Preview Banner */}
          {invitePreview && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Trip Group Invitation</span>
              </div>
              <div>
                <h3 className="text-white font-extrabold text-sm sm:text-base">
                  {invitePreview.trip?.name}
                </h3>
                <p className="text-xs text-slate-300">
                  Invited by <strong className="text-emerald-300">{invitePreview.inviter?.name || 'A trip member'}</strong>
                </p>
              </div>
              {invitePreview.invite?.invitedEmail && (
                <div className="text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                  Invitation reserved for: <strong>{invitePreview.invite.invitedEmail}</strong>
                </div>
              )}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {mode === 'REGISTER'
                  ? 'Complete your registration below to accept this invitation and enter the trip workspace.'
                  : 'Log in with your account to accept this invitation and enter the trip workspace.'}
              </p>
            </div>
          )}

          {/* Invitation Error / Invalid link warning */}
          {inviteError && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Notice: {inviteError}. You can still log in or sign up below.</span>
            </div>
          )}

          {/* Form Error Message */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Forgot Password Notice Modal */}
          {showForgotPassword && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-slate-200 font-bold">
                <span>Password Assistance</span>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11.5px]">
                To reset your password, please contact your trip workspace administrator or send an email to <strong className="text-indigo-400">support@tripmate.app</strong>.
              </p>
            </div>
          )}

          {mode === 'LOGIN' ? (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm py-3 rounded-xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Log In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Mode Toggle */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('REGISTER');
                  }}
                  className="text-xs text-slate-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Don't have an account? <strong className="text-indigo-400 font-bold">Sign up</strong>
                </button>
              </div>
            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirm Password *
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm py-3 rounded-xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Account & Join</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Mode Toggle */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('LOGIN');
                  }}
                  className="text-xs text-slate-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Already have an account? <strong className="text-indigo-400 font-bold">Log in</strong>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
