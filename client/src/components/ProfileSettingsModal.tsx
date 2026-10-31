import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  User,
  Mail,
  Phone,
  FileText,
  KeyRound,
  Shield,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Calendar,
  Layers,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  apiUpdateProfile,
  apiChangePassword,
  apiRequestEmailChange,
  apiVerifyEmailChange,
  apiDeleteAccount,
  apiUploadFile,
  setAuthToken,
} from '../services/api';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUserUpdated: (updatedUser: any) => void;
  onLogout: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
];

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'danger'>('profile');

  // Profile Form State
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarPublicId, setAvatarPublicId] = useState<string | undefined>(undefined);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Email Change State
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmailSent, setPendingEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);

  // Danger Zone / Delete Account State
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setPhone(user.phone || '');
      setAvatar(user.avatar || '');
      setAvatarPublicId(user.avatarPublicId || undefined);
      setProfileSuccessMsg(null);
      setProfileErrorMsg(null);
      setPasswordSuccessMsg(null);
      setPasswordErrorMsg(null);
      setEmailSuccessMsg(null);
      setEmailErrorMsg(null);
      setDeleteErrorMsg(null);
      setShowEmailForm(false);
      setPendingEmailSent(false);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // Handle Photo Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const lastDot = file.name.lastIndexOf('.');
    const fileExt = lastDot !== -1 ? file.name.toLowerCase().substring(lastDot) : '';

    if (!allowedMimeTypes.includes(file.type) || !allowedExtensions.includes(fileExt)) {
      setProfileErrorMsg('Please select a valid image file (JPEG, PNG, WEBP). SVG is not allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setProfileErrorMsg('Profile photo size must not exceed 10MB.');
      return;
    }

    setUploadingImage(true);
    setProfileErrorMsg(null);

    try {
      const uploadRes = await apiUploadFile(file, 'profiles');
      setAvatar(uploadRes.url || uploadRes.secureUrl);
      setAvatarPublicId(uploadRes.publicId);
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setProfileErrorMsg(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectDicebear = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(randomSeed)}`;
    setAvatar(dicebearUrl);
    setAvatarPublicId(undefined);
  };

  // Save General Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileErrorMsg('Display name is required.');
      return;
    }
    if (name.trim().length > 100) {
      setProfileErrorMsg('Display name cannot exceed 100 characters.');
      return;
    }
    if (bio.trim().length > 500) {
      setProfileErrorMsg('Bio cannot exceed 500 characters.');
      return;
    }

    setSavingProfile(true);
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    try {
      const res = await apiUpdateProfile({
        name: name.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        avatar: avatar.trim() || undefined,
        avatarPublicId: avatarPublicId || undefined,
      });

      onUserUpdated(res.user);
      setProfileSuccessMsg('Profile updated successfully!');
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (!currentPassword) {
      setPasswordErrorMsg('Current password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New password and confirm password do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await apiChangePassword(currentPassword, newPassword);
      setPasswordSuccessMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(null), 3000);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Request Email Change
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErrorMsg(null);
    setEmailSuccessMsg(null);

    if (!newEmail.trim()) {
      setEmailErrorMsg('New email address is required.');
      return;
    }
    if (!emailPassword) {
      setEmailErrorMsg('Current password is required to verify your identity.');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await apiRequestEmailChange(newEmail.trim(), emailPassword);
      setPendingEmailSent(true);
      setEmailSuccessMsg(res.message || 'Verification code sent to your new email.');
    } catch (err: any) {
      setEmailErrorMsg(err.message || 'Failed to request email change.');
    } finally {
      setEmailLoading(false);
    }
  };

  // Verify Email Change
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErrorMsg(null);
    setEmailSuccessMsg(null);

    if (!verificationCode.trim()) {
      setEmailErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await apiVerifyEmailChange(verificationCode.trim());
      if (res.token) {
        setAuthToken(res.token);
      }
      onUserUpdated(res.user);
      setEmailSuccessMsg('Email updated successfully!');
      setShowEmailForm(false);
      setPendingEmailSent(false);
      setNewEmail('');
      setEmailPassword('');
      setVerificationCode('');
      setTimeout(() => setEmailSuccessMsg(null), 3000);
    } catch (err: any) {
      setEmailErrorMsg(err.message || 'Failed to verify email code.');
    } finally {
      setEmailLoading(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteErrorMsg(null);

    if (!deletePassword) {
      setDeleteErrorMsg('Current password is required to delete your account.');
      return;
    }
    const cleanConfirm = deleteConfirmation.trim().toLowerCase();
    if (cleanConfirm !== 'delete' && cleanConfirm !== user.email.toLowerCase()) {
      setDeleteErrorMsg(`Please type "DELETE" or your email (${user.email}) to confirm.`);
      return;
    }

    setDeletingAccount(true);
    try {
      await apiDeleteAccount(deletePassword, deleteConfirmation);
      onClose();
      onLogout();
    } catch (err: any) {
      setDeleteErrorMsg(err.message || 'Failed to delete account.');
      setDeletingAccount(false);
    }
  };

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recently';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden relative">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#111b21] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-none">Profile & Account Settings</h2>
              <p className="text-xs text-slate-400 mt-1">Manage personal details, security, and preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-[#0d1418] px-4 pt-2 gap-2 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Info</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Account & Security</span>
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'danger'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-rose-400'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Danger Zone</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: PROFILE INFO */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {profileErrorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}
              {profileSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {/* Avatar Section */}
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-[#162127] p-4 rounded-2xl border border-slate-800">
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-500/40 bg-slate-800 flex-shrink-0 group shadow-lg">
                  <img
                    src={avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                    alt="User avatar preview"
                    className="w-full h-full object-cover"
                  />
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <p className="text-xs font-semibold text-slate-200">Profile Photo</p>
                  <p className="text-[11px] text-slate-400">JPG, PNG, or WebP. Max 10MB.</p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectDicebear}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Random Avatar</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Preset Avatars */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Or select a preset avatar:
                </label>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {PRESET_AVATARS.map((presetUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAvatar(presetUrl);
                        setAvatarPublicId(undefined);
                      }}
                      className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all flex-shrink-0 ${
                        avatar === presetUrl
                          ? 'border-indigo-400 ring-2 ring-indigo-500/40 scale-105'
                          : 'border-slate-800 hover:border-slate-600 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={presetUrl} alt="Preset avatar" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Display Name <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500">{name.length}/100</span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {/* Bio */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Bio / Status
                  </label>
                  <span className="text-[10px] text-slate-500">{bio.length}/500</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short note about yourself or your travel interests..."
                  className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    maxLength={25}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#182229] border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Optional. Used for group communications.</p>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile || uploadingImage}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <span>Save Profile Changes</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: ACCOUNT & SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Account Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#182229] p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Member Since</p>
                    <p className="text-xs font-semibold text-slate-100 truncate">{memberSince}</p>
                  </div>
                </div>

                <div className="bg-[#182229] p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trip Groups Joined</p>
                    <p className="text-xs font-semibold text-slate-100">{user.groupCount ?? 'Active'}</p>
                  </div>
                </div>
              </div>

              {/* Email Address Section */}
              <div className="bg-[#162127] p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Email Address</h3>
                    <p className="text-sm font-semibold text-slate-100 mt-0.5">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailForm(!showEmailForm);
                      setEmailErrorMsg(null);
                      setEmailSuccessMsg(null);
                    }}
                    className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                  >
                    {showEmailForm ? 'Cancel' : 'Change Email'}
                  </button>
                </div>

                {emailSuccessMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>{emailSuccessMsg}</span>
                  </div>
                )}
                {emailErrorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{emailErrorMsg}</span>
                  </div>
                )}

                {showEmailForm && (
                  <div className="pt-2 border-t border-slate-800/80 mt-2 space-y-3">
                    {!pendingEmailSent ? (
                      <form onSubmit={handleRequestEmailChange} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            New Email Address
                          </label>
                          <input
                            type="email"
                            required
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="new.email@example.com"
                            className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Current Password
                          </label>
                          <input
                            type="password"
                            required
                            value={emailPassword}
                            onChange={(e) => setEmailPassword(e.target.value)}
                            placeholder="Verify your current password"
                            className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={emailLoading}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow"
                        >
                          {emailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                          <span>Send 6-Digit Verification Code</span>
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyEmail} className="space-y-3">
                        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
                          A 6-digit verification code was sent to <strong>{newEmail}</strong>.
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Enter 6-Digit Code
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            placeholder="123456"
                            className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2 text-center tracking-widest text-base font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={emailLoading}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow"
                        >
                          {emailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Confirm & Update Email</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Change Password Form */}
              <div className="bg-[#162127] p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Change Password</h3>
                </div>

                {passwordSuccessMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>{passwordSuccessMsg}</span>
                  </div>
                )}
                {passwordErrorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{passwordErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      maxLength={128}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      maxLength={128}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow"
                  >
                    {savingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Permanent Account Deletion</span>
                </div>
                <p>
                  Deleting your account will remove your personal profile and revoke access to all trip workspaces.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] pt-1">
                  <li>If you are the group owner of any active trip, you must transfer ownership first.</li>
                  <li>All outstanding trip financial balances and debts must be fully settled.</li>
                  <li>Historical expense records are preserved for accounting audit integrity.</li>
                </ul>
              </div>

              {deleteErrorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{deleteErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleDeleteAccount} className="space-y-3 bg-[#162127] p-4 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    To confirm, type <span className="text-white font-bold">DELETE</span> or your email (
                    <span className="text-indigo-400">{user.email}</span>)
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-[#182229] border border-rose-500/40 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Enter your account password
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#182229] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={deletingAccount}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/20"
                >
                  {deletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting Account...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Permanently Delete My Account</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

