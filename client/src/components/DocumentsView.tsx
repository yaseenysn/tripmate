import React, { useState, useRef } from 'react';
import { FileText, Plus, Download, Trash2, Upload, Loader2 } from 'lucide-react';
import { apiCreateDocument, apiDeleteDocument, apiUploadFile } from '../services/api';

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
  const [publicId, setPublicId] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (!name) {
      setName(file.name);
    }

    setUploading(true);
    setError('');
    try {
      const uploadRes = await apiUploadFile(file, 'documents');
      setFileUrl(uploadRes.secureUrl || uploadRes.url);
      setPublicId(uploadRes.publicId);
      const sizeMb = (uploadRes.bytes / (1024 * 1024)).toFixed(1);
      setFileSize(`${sizeMb} MB`);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file to Cloudinary');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (!fileUrl && !selectedFile)) {
      setError('Please select a file or provide a valid URL');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let finalUrl = fileUrl;
      let finalPublicId = publicId;

      if (!finalUrl && selectedFile) {
        const uploadRes = await apiUploadFile(selectedFile, 'documents');
        finalUrl = uploadRes.secureUrl || uploadRes.url;
        finalPublicId = uploadRes.publicId;
      }

      await apiCreateDocument(tripId, {
        name,
        type,
        fileUrl: finalUrl,
        publicId: finalPublicId,
        fileSize: fileSize || '1.2 MB'
      });

      setShowAddModal(false);
      setName('');
      setFileUrl('');
      setPublicId('');
      setSelectedFile(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create document');
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
          <p className="text-xs text-slate-500 mt-1">Store travel tickets, receipts, and hotel confirmation PDFs securely via Cloudinary.</p>
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
            <h3 className="text-lg font-bold text-slate-100 mb-4">Upload Document to Cloudinary</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleUploadDoc} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Select File *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full bg-slate-800 border border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-cyan-400 transition-all"
                >
                  {uploading ? (
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-medium">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading to Cloudinary...</span>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                      <FileText className="w-5 h-5" />
                      <span>{selectedFile.name} (Uploaded)</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-xs font-semibold">Click to choose image or document</span>
                      <span className="text-[10px] text-slate-500">PDF, JPG, PNG, DOC, TXT (Max 10MB)</span>
                    </>
                  )}
                </button>
              </div>

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
                  disabled={loading || uploading}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
