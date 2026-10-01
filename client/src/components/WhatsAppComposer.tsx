import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Send, Mic, Camera, DollarSign, Calendar,
  Ticket, CheckSquare, Vote, FileText, X
} from 'lucide-react';

interface WhatsAppComposerProps {
  onSendMessage: (message: string) => void;
  onSelectAction: (
    actionType: 'EXPENSE' | 'ITINERARY' | 'BOOKING' | 'TASK' | 'POLL' | 'DOCUMENT'
  ) => void;
}

export const WhatsAppComposer: React.FC<WhatsAppComposerProps> = ({
  onSendMessage,
  onSelectAction,
}) => {
  const [messageText, setMessageText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close popup menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    onSendMessage(messageText.trim());
    setMessageText('');
  };

  const handleActionClick = (
    type: 'EXPENSE' | 'ITINERARY' | 'BOOKING' | 'TASK' | 'POLL' | 'DOCUMENT'
  ) => {
    setShowAttachmentMenu(false);
    onSelectAction(type);
  };

  const actionItems = [
    {
      type: 'EXPENSE' as const,
      label: 'Expense',
      icon: DollarSign,
      bgColor: 'bg-emerald-600 hover:bg-emerald-500',
      iconColor: 'text-white'
    },
    {
      type: 'ITINERARY' as const,
      label: 'Itinerary',
      icon: Calendar,
      bgColor: 'bg-blue-600 hover:bg-blue-500',
      iconColor: 'text-white'
    },
    {
      type: 'BOOKING' as const,
      label: 'Booking',
      icon: Ticket,
      bgColor: 'bg-purple-600 hover:bg-purple-500',
      iconColor: 'text-white'
    },
    {
      type: 'TASK' as const,
      label: 'Task',
      icon: CheckSquare,
      bgColor: 'bg-amber-600 hover:bg-amber-500',
      iconColor: 'text-white'
    },
    {
      type: 'POLL' as const,
      label: 'Poll',
      icon: Vote,
      bgColor: 'bg-rose-600 hover:bg-rose-500',
      iconColor: 'text-white'
    },
    {
      type: 'DOCUMENT' as const,
      label: 'Document',
      icon: FileText,
      bgColor: 'bg-indigo-600 hover:bg-indigo-500',
      iconColor: 'text-white'
    },
  ];

  return (
    <div className="sticky bottom-0 z-30 bg-[#111b21] border-t border-slate-800/80 px-3 py-2.5 flex flex-col items-center select-none">
      {/* WhatsApp Attachment Action Sheet Popup */}
      {showAttachmentMenu && (
        <div
          ref={menuRef}
          className="absolute bottom-16 left-4 z-40 bg-[#1f2c34] border border-slate-700/80 p-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-3 fade-in duration-200 w-64 sm:w-72"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/60">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Add to Trip</span>
            <button
              onClick={() => setShowAttachmentMenu(false)}
              className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-700/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Camera / Photo Option */}
            <button
              onClick={() => {
                setShowAttachmentMenu(false);
                alert('Photo upload integration ready!');
              }}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-pink-600 hover:bg-pink-500 flex items-center justify-center text-white shadow-md mb-1.5 transition-transform group-hover:scale-105">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-300">Photo</span>
            </button>

            {actionItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => handleActionClick(item.type)}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors group"
                >
                  <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center text-white shadow-md mb-1.5 transition-transform group-hover:scale-105`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main WhatsApp Composer Bar: [+] [ Message... ] [ Send ] */}
      <form onSubmit={handleSend} className="w-full flex items-center gap-2 max-w-4xl mx-auto">
        {/* [+] Action Sheet Toggle Button */}
        <button
          type="button"
          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
            showAttachmentMenu
              ? 'bg-rose-600 text-white rotate-45'
              : 'bg-[#202c33] text-slate-300 hover:text-white hover:bg-slate-700/80'
          }`}
          title="Add expense, itinerary, task..."
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Input Field */}
        <div className="flex-1 flex items-center bg-[#2a3942] rounded-2xl px-4 py-2 border border-slate-700/60 focus-within:border-emerald-500/60 transition-colors">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Message..."
            className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs sm:text-sm focus:outline-none"
          />
        </div>

        {/* Microphone / Send Button */}
        {messageText.trim() ? (
          <button
            type="submit"
            className="p-2.5 rounded-full bg-[#00a884] hover:bg-emerald-500 text-white shadow-md flex-shrink-0 transition-all active:scale-95"
            title="Send Message"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => alert('Voice note feature coming soon!')}
            className="p-2.5 rounded-full bg-[#202c33] hover:bg-slate-700/80 text-slate-300 hover:text-white shadow-sm flex-shrink-0 transition-all"
            title="Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </form>
    </div>
  );
};
