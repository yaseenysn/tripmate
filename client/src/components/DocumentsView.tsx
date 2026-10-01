import React, { useState } from 'react';
import { FileText, Plus, Download, Trash2, Image, FileCheck } from 'lucide-react';
import { apiCreateDocument, apiDeleteDocument } from '../services/api';

interface DocumentsViewProps {
  tripId: string;
  documents: any[];
  openAddModal?: boolean;
  onRefresh: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  tripId,
  documents,
  openAddModal = false,
  onRefresh
}) => {
  const [showAddModal, setShowAddModal] = useState(openAddModal);

  React.useEffect(() => {
    if (openAddModal) setShowAddModal(true);
  }, [openAddModal]);
  const [name, setName] = useState('');
  const [type, setType] = useState('TICKET');
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setLoading(true);
    try {
      await apiCreateDocument(tripId, {
        name,
        type,
        fileUrl: fileUrl || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=400&q=80',
        fileSize: '1.2 MB'
      });
      setShowAddModal(false);
      setName('');
      setFileUrl('');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Delete document?')) return;
    try {
      await apiDeleteDocument(tripId, id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="glass-panel p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block mb-1">
            Trip Vault
          </span>
          <h2 className="text-xl font-bold text-slate-100">{documents.length} Stored Documents</h2>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">No documents uploaded</h3>
          <p className="text-xs text-slate-500 mt-1">Store travel tickets, receipts, and hotel confirmation PDFs securely.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map(doc => (
            <div key={doc._id} className="glass-card p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-100 text-sm truncate">{doc.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {doc.type} • {doc.fileSize || '1.2 MB'} • Uploaded by {doc.uploadedBy?.name || 'User'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition-all"
                  title="View / Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDeleteDoc(doc._id)}
                  className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Upload Document</h3>
            <form onSubmit={handleUploadDoc} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flight Tickets.pdf"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-sm focus:outline-none"
                >
                  <option value="TICKET">Ticket</option>
                  <option value="RECEIPT">Receipt</option>
                  <option value="CONFIRMATION">Confirmation</option>
                  <option value="ID">ID / Passport</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  File URL / Cloud Link
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
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
                  className="flex-1 bg-cyan-600 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg"
                >
                  Upload File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
