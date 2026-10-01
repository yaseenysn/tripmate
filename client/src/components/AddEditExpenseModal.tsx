import React, { useState, useEffect } from 'react';
import { X, DollarSign, Tag, User, Users, Percent, Check, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { apiCreateExpense, apiUpdateExpense, apiUploadFile } from '../services/api';

interface AddEditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  members: any[];
  currentUser: any;
  expenseToEdit?: any;
  onSuccess: () => void;
}

const CATEGORIES = [
  'Food',
  'Accommodation',
  'Transportation',
  'Activities',
  'Local Transport',
  'Shopping',
  'Emergency',
  'Miscellaneous'
];

export const AddEditExpenseModal: React.FC<AddEditExpenseModalProps> = ({
  isOpen,
  onClose,
  tripId,
  members,
  currentUser,
  expenseToEdit,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const isEditMode = Boolean(expenseToEdit);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState<'EQUAL' | 'CUSTOM' | 'PERCENTAGE'>('EQUAL');
  const [notes, setNotes] = useState('');

  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptPublicId, setReceiptPublicId] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Selected participants & custom inputs map: userId -> share/pct
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [customPcts, setCustomPcts] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize form state from expenseToEdit or default
  useEffect(() => {
    if (expenseToEdit) {
      setTitle(expenseToEdit.title || '');
      setAmount(expenseToEdit.amount ? String(expenseToEdit.amount) : '');
      setCategory(expenseToEdit.category || 'Food');
      setPaidBy(expenseToEdit.paidBy?._id || expenseToEdit.paidBy || currentUser?._id || '');
      setSplitType(expenseToEdit.splitType || 'EQUAL');
      setNotes(expenseToEdit.notes || '');
      setReceiptUrl(expenseToEdit.receiptUrl || '');
      setReceiptPublicId(expenseToEdit.receiptPublicId || '');

      if (expenseToEdit.participants && expenseToEdit.participants.length > 0) {
        const pIds = expenseToEdit.participants.map((p: any) => p.userId?._id || p.userId);
        setSelectedMembers(pIds);

        const sharesMap: Record<string, string> = {};
        const pctsMap: Record<string, string> = {};
        expenseToEdit.participants.forEach((p: any) => {
          const uId = p.userId?._id || p.userId;
          if (p.share !== undefined) sharesMap[uId] = String(p.share);
          if (p.percentage !== undefined) pctsMap[uId] = String(p.percentage);
        });
        setCustomShares(sharesMap);
        setCustomPcts(pctsMap);
      } else {
        setSelectedMembers(members.map((m: any) => m.user?._id || m.userId?._id || m.userId));
      }
    } else {
      setTitle('');
      setAmount('');
      setCategory('Food');
      setPaidBy(currentUser?._id || (members[0]?.user?._id || members[0]?.userId?._id || ''));
      setSplitType('EQUAL');
      setNotes('');
      setReceiptUrl('');
      setReceiptPublicId('');
      setSelectedMembers(members.map((m: any) => m.user?._id || m.userId?._id || m.userId));
      setCustomShares({});
      setCustomPcts({});
    }
  }, [expenseToEdit, isOpen, members, currentUser]);

  const toggleMember = (uId: string) => {
    if (selectedMembers.includes(uId)) {
      if (selectedMembers.length === 1) return; // Must have at least 1 member
      setSelectedMembers(selectedMembers.filter((id) => id !== uId));
    } else {
      setSelectedMembers([...selectedMembers, uId]);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    setError('');
    try {
      const res = await apiUploadFile(file, 'expenses');
      setReceiptUrl(res.secureUrl || res.url);
      setReceiptPublicId(res.publicId);
    } catch (err: any) {
      setError(err.message || 'Failed to upload receipt');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0) {
      setError('Please provide a valid title and positive amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const numAmount = Number(amount);
      const participantsPayload = selectedMembers.map((uId) => {
        const item: any = { userId: uId };
        if (splitType === 'CUSTOM') {
          item.share = Number(customShares[uId] || 0);
        } else if (splitType === 'PERCENTAGE') {
          item.percentage = Number(customPcts[uId] || 0);
          item.share = Math.round((numAmount * (item.percentage / 100)) * 100) / 100;
        }
        return item;
      });

      const payload = {
        title: title.trim(),
        amount: numAmount,
        category,
        paidBy: paidBy || currentUser?._id,
        splitType,
        participants: participantsPayload,
        notes: notes.trim(),
        receiptUrl: receiptUrl || undefined,
        receiptPublicId: receiptPublicId || undefined,
      };

      if (isEditMode) {
        await apiUpdateExpense(tripId, expenseToEdit._id, payload);
      } else {
        await apiCreateExpense(tripId, payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#1f2c34]">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>{isEditMode ? 'Edit Expense' : 'Add New Expense'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/80"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Amount & Title */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Expense Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Tuesday Kabab Dinner"
                className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="2400"
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white font-extrabold text-base focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Paid By */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Paid By</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full bg-[#202c33] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
            >
              {members.map((m) => {
                const u = m.user || m.userId || {};
                return (
                  <option key={u._id} value={u._id}>
                    {u.name || 'Member'} ({u._id === currentUser?._id ? 'You' : u.email})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Split Type Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Split Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['EQUAL', 'CUSTOM', 'PERCENTAGE'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSplitType(st)}
                  className={`py-2 px-3 rounded-xl border font-bold text-[11px] transition-all ${
                    splitType === st
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-[#202c33] text-slate-400 border-slate-700/80 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Split Members Checklist */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-300 uppercase">
              Split Among ({selectedMembers.length} Members)
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {members.map((m) => {
                const u = m.user || m.userId || {};
                const uId = u._id;
                const isSelected = selectedMembers.includes(uId);

                return (
                  <div
                    key={uId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-[#1f2c34] border-emerald-500/50 text-slate-100'
                        : 'bg-[#202c33]/50 border-slate-800 text-slate-500'
                    }`}
                  >
                    <div
                      onClick={() => toggleMember(uId)}
                      className="flex items-center gap-2.5 cursor-pointer flex-1"
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="font-semibold">{u.name || 'Member'}</span>
                    </div>

                    {/* Custom Input depending on Split Type */}
                    {isSelected && splitType === 'CUSTOM' && (
                      <div className="flex items-center gap-1 w-24">
                        <span className="text-slate-400 text-[10px]">₹</span>
                        <input
                          type="number"
                          value={customShares[uId] || ''}
                          onChange={(e) => setCustomShares({ ...customShares, [uId]: e.target.value })}
                          placeholder="0"
                          className="w-full bg-[#111b21] border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs font-bold text-right focus:outline-none"
                        />
                      </div>
                    )}

                    {isSelected && splitType === 'PERCENTAGE' && (
                      <div className="flex items-center gap-1 w-20">
                        <input
                          type="number"
                          value={customPcts[uId] || ''}
                          onChange={(e) => setCustomPcts({ ...customPcts, [uId]: e.target.value })}
                          placeholder="0"
                          className="w-full bg-[#111b21] border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs font-bold text-right focus:outline-none"
                        />
                        <span className="text-slate-400 text-[10px]">%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Receipt Attachment (Optional)</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer bg-[#202c33] hover:bg-slate-700/80 border border-slate-700/80 rounded-xl px-3 py-2 flex items-center justify-between text-slate-300 transition-all">
                <span className="text-[11px] font-medium truncate">
                  {uploadingReceipt ? 'Uploading to Cloudinary...' : receiptUrl ? 'Receipt attached ✓' : 'Upload receipt image/PDF'}
                </span>
                {uploadingReceipt ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-slate-400" />
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleReceiptUpload}
                  disabled={uploadingReceipt}
                  className="hidden"
                />
              </label>
              {receiptUrl && (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30 font-semibold hover:bg-emerald-600/30"
                  title="View attached receipt"
                >
                  View
                </a>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isEditMode ? 'Update Expense' : 'Create Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
