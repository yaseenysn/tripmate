import React, { useState } from 'react';
import { Compass, Mail, Lock, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiLogin, apiRegister, setAuthToken } from '../services/api';

interface AuthViewProps {
  onAuthSuccess: (user: any, token: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail || !loginPassword) {
      setError('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiLogin(loginEmail, loginPassword);
      if (res.token && res.user) {
        setAuthToken(res.token);
        onAuthSuccess(res.user, res.token);
      } else {
        setError('Invalid response from server.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
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
      const res = await apiRegister(regName, regEmail, regPassword);
      if (res.token && res.user) {
        setAuthToken(res.token);
        onAuthSuccess(res.user, res.token);
      } else {
        setError('Failed to create account.');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Helper for quick demo user login
  const handleQuickDemoLogin = async (email: string) => {
    setLoginEmail(email);
    setLoginPassword('password123');
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email, 'password123');
      if (res.token && res.user) {
        setAuthToken(res.token);
        onAuthSuccess(res.user, res.token);
      }
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
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
            {mode === 'LOGIN' ? 'Log in to your trip workspace' : 'Create an account to start planning trips'}
          </p>
        </div>

        {/* Auth Card Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
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
                    placeholder="yaseen@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
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

              {/* Quick Demo Accounts */}
              <div className="pt-4 border-t border-slate-800/80 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 text-center block">
                  Quick Demo Accounts
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('yaseen@example.com')}
                    className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 rounded-xl border border-slate-800 text-center truncate"
                  >
                    Yaseen
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('bilal@example.com')}
                    className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 rounded-xl border border-slate-800 text-center truncate"
                  >
                    Bilal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('amal@example.com')}
                    className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 rounded-xl border border-slate-800 text-center truncate"
                  >
                    Amal
                  </button>
                </div>
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
                    placeholder="e.g. Yaseen"
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
                    <span>Create Account</span>
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
