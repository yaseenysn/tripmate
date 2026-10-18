import React, { useEffect } from 'react';
import { X, Download, ExternalLink, User, Calendar } from 'lucide-react';
import { sanitizeUrl } from '../utils/security';

interface ImagePreviewModalProps {
  isOpen?: boolean;
  onClose: () => void;
  imageUrl?: string;
  title?: string;
  uploaderName?: string;
  date?: Date | string;
  fileSize?: string;
  photo?: {
    url: string;
    title?: string;
    uploader?: string;
    date?: any;
    size?: string;
  } | null;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen = true,
  onClose,
  imageUrl,
  title = 'Trip Photo',
  uploaderName,
  date,
  fileSize,
  photo,
}) => {
  const finalUrl = photo?.url || imageUrl || '';
  const finalTitle = photo?.title || title || 'Trip Photo';
  const finalUploader = photo?.uploader || uploaderName;
  const finalDate = photo?.date || date;
  const finalSize = photo?.size || fileSize;

  const isVisible = (isOpen ?? true) && Boolean(finalUrl);

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const dateFormatted = finalDate
    ? new Date(finalDate).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-[#111b21] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#1e262c] border-b border-slate-800/80">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm sm:text-base font-bold text-white truncate">{finalTitle}</h3>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
              {finalUploader && (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <User className="w-3 h-3" />
                  <span>{finalUploader}</span>
                </span>
              )}
              {dateFormatted && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>{dateFormatted}</span>
                </span>
              )}
              {finalSize && (
                <span className="text-slate-500 font-mono">• {finalSize}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={sanitizeUrl(finalUrl)}
              target="_blank"
              rel="noreferrer"
              download
              className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-all"
              title="Download full size"
            >
              <Download className="w-4 h-4" />
            </a>
            <a
              href={sanitizeUrl(finalUrl)}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-all"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Container */}
        <div className="flex-1 min-h-0 bg-slate-950/70 p-2 sm:p-4 flex items-center justify-center overflow-auto">
          <img
            src={finalUrl}
            alt={finalTitle}
            className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-white/5"
          />
        </div>
      </div>
    </div>
  );
};
