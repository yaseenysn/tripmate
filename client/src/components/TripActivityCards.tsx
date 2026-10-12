import React, { useState } from 'react';
import {
  Camera, FileText, Calendar, Ticket, CheckSquare, Vote,
  Clock, MapPin, Download, ExternalLink, ChevronRight,
  CheckCircle2, Circle, AlertCircle, User, Loader2
} from 'lucide-react';

// ============================================================================
// 1. PHOTO MESSAGE CARD
// ============================================================================
export interface PhotoMessageCardProps {
  document: any;
  senderName?: string;
  timestamp?: Date | string;
  isSelf?: boolean;
  onOpenPreview: (photo: { url: string; title: string; uploader?: string; date?: any; size?: string }) => void;
}

export const PhotoMessageCard: React.FC<PhotoMessageCardProps> = ({
  document: doc,
  timestamp,
  onOpenPreview,
}) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const title = doc?.name || 'Photo';
  const fileUrl = doc?.fileUrl || '';
  const fileSize = doc?.fileSize || '';
  const uploaderName = doc?.uploadedBy?.name || 'Member';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileUrl) {
      onOpenPreview({
        url: fileUrl,
        title,
        uploader: uploaderName,
        date: doc?.createdAt || timestamp,
        size: fileSize,
      });
    }
  };

  return (
    <div
      onClick={handleClick}
      className="bg-[#1e262c] border border-slate-700/80 hover:border-pink-500/40 rounded-2xl p-2.5 sm:p-3 cursor-pointer transition-all shadow-md flex flex-col space-y-2 w-full max-w-[280px] sm:max-w-[320px] text-left group"
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-pink-400">
          <Camera className="w-3.5 h-3.5 text-pink-400" />
          <span className="tracking-wide uppercase text-[10px] font-extrabold">Photo</span>
        </div>
        {fileSize && (
          <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
            {fileSize}
          </span>
        )}
      </div>

      {/* Image Thumbnail Preview */}
      <div className="relative w-full h-36 sm:h-40 rounded-xl overflow-hidden bg-slate-950/80 border border-slate-800 flex items-center justify-center">
        {!imgError && fileUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 bg-slate-900">
                <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
              </div>
            )}
            <img
              src={fileUrl}
              alt={title}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`w-full h-full object-cover transition-all group-hover:scale-105 duration-300 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-3 text-slate-400 gap-1 text-center">
            <Camera className="w-8 h-8 text-slate-600 mb-1" />
            <span className="text-xs font-medium text-slate-300 truncate max-w-[200px]">{title}</span>
            <span className="text-[10px] text-slate-500">Tap to view</span>
          </div>
        )}

        {/* Hover zoom overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20">
            Tap to view
          </span>
        </div>
      </div>

      {/* Caption & Metadata Footer */}
      <div className="flex items-center justify-between text-[11px] pt-0.5">
        <span className="font-medium text-slate-200 truncate pr-2 max-w-[190px]" title={title}>
          {title}
        </span>
        <span className="text-pink-400 font-semibold group-hover:underline flex items-center gap-0.5 flex-shrink-0 text-[10px]">
          View <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// 2. DOCUMENT MESSAGE CARD
// ============================================================================
export interface DocumentMessageCardProps {
  document: any;
  onNavigateSection?: (section: string) => void;
}

export const DocumentMessageCard: React.FC<DocumentMessageCardProps> = ({
  document: doc,
  onNavigateSection,
}) => {
  const name = doc?.name || 'Document';
  const fileUrl = doc?.fileUrl || '';
  const fileSize = doc?.fileSize || 'Attachment';
  const docType = doc?.type || 'DOCUMENT';

  // File extension badge
  const extMatch = name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = (extMatch ? extMatch[1] : docType).toUpperCase();

  const isPdf = ext === 'PDF';
  const iconColor = isPdf ? 'text-rose-400' : 'text-blue-400';
  const badgeBg = isPdf ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

  return (
    <div className="bg-[#1e262c] border border-slate-700/80 hover:border-blue-500/40 rounded-2xl p-3 sm:p-3.5 transition-all shadow-md flex flex-col space-y-2.5 w-full max-w-[280px] sm:max-w-[320px] text-left group">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span className="tracking-wide uppercase text-[10px] font-extrabold">Document</span>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeBg}`}>
          {ext}
        </span>
      </div>

      {/* Document Information Row */}
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <FileText className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-xs sm:text-sm text-slate-100 truncate leading-snug" title={name}>
            {name}
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
            {fileSize} • {docType}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-1 flex items-center justify-between border-t border-slate-700/40 gap-2">
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            className="flex-1 py-1.5 px-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Open / Download</span>
          </a>
        ) : onNavigateSection ? (
          <button
            type="button"
            onClick={() => onNavigateSection('documents')}
            className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-xl flex items-center justify-center gap-1 transition-all"
          >
            <span>View in Vault</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
};

// ============================================================================
// 3. ITINERARY MESSAGE CARD
// ============================================================================
export interface ItineraryMessageCardProps {
  item: any;
  onNavigateSection?: (section: string) => void;
}

export const ItineraryMessageCard: React.FC<ItineraryMessageCardProps> = ({
  item,
  onNavigateSection,
}) => {
  const title = item?.title || 'Itinerary Event';
  const dayNumber = item?.dayNumber || 1;
  const location = item?.location || '';
  const startTime = item?.startTime || '';

  return (
    <div
      onClick={() => onNavigateSection && onNavigateSection('itinerary')}
      className="bg-[#1e262c] border border-slate-700/80 hover:border-cyan-500/40 rounded-2xl p-3 sm:p-3.5 cursor-pointer transition-all shadow-md flex flex-col space-y-2.5 w-full max-w-[280px] sm:max-w-[320px] text-left group"
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span className="tracking-wide uppercase text-[10px] font-extrabold">Itinerary</span>
        </div>
        <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
          Day {dayNumber}
        </span>
      </div>

      {/* Main Content */}
      <div className="space-y-1 min-w-0">
        <h4 className="font-bold text-sm text-white group-hover:text-cyan-200 transition-colors leading-snug truncate">
          {title}
        </h4>

        {location && (
          <p className="text-xs text-slate-300 flex items-center gap-1.5 truncate">
            <MapPin className="w-3 h-3 text-rose-400 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        )}

        {startTime && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span>{startTime}</span>
          </p>
        )}
      </div>

      {/* Bottom Action */}
      <div className="pt-1 border-t border-slate-700/40 flex items-center justify-between text-xs font-bold text-cyan-400 group-hover:underline">
        <span>View itinerary</span>
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
};

// ============================================================================
// 4. BOOKING MESSAGE CARD
// ============================================================================
export interface BookingMessageCardProps {
  booking: any;
  onNavigateSection?: (section: string) => void;
}

export const BookingMessageCard: React.FC<BookingMessageCardProps> = ({
  booking,
  onNavigateSection,
}) => {
  const provider = booking?.provider || booking?.type || 'Booking';
  const type = (booking?.type || 'HOTEL').toUpperCase();
  const date = booking?.date
    ? new Date(booking.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const cost = Number(booking?.cost || 0);
  const ref = booking?.bookingReference || '';

  return (
    <div
      onClick={() => onNavigateSection && onNavigateSection('bookings')}
      className="bg-[#1e262c] border border-slate-700/80 hover:border-purple-500/40 rounded-2xl p-3 sm:p-3.5 cursor-pointer transition-all shadow-md flex flex-col space-y-2.5 w-full max-w-[280px] sm:max-w-[320px] text-left group"
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
          <Ticket className="w-3.5 h-3.5 text-purple-400" />
          <span className="tracking-wide uppercase text-[10px] font-extrabold">{type}</span>
        </div>
        {cost > 0 && (
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
            ₹{cost.toLocaleString()}
          </span>
        )}
      </div>

      {/* Booking Details */}
      <div className="space-y-1 min-w-0">
        <h4 className="font-bold text-sm text-white group-hover:text-purple-200 transition-colors leading-snug truncate">
          {provider}
        </h4>

        <div className="flex items-center gap-3 text-xs text-slate-300">
          {date && <span>📅 {date}</span>}
          {booking?.time && <span>⏰ {booking.time}</span>}
          {ref && <span className="text-slate-400 font-mono text-[10px]">Ref: {ref}</span>}
        </div>
      </div>

      {/* Bottom Action */}
      <div className="pt-1 border-t border-slate-700/40 flex items-center justify-between text-xs font-bold text-purple-400 group-hover:underline">
        <span>View booking</span>
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
};

// ============================================================================
// 5. TASK MESSAGE CARD
// ============================================================================
export interface TaskMessageCardProps {
  task: any;
  onToggleStatus?: (taskId: string, currentStatus: string) => void;
  onNavigateSection?: (section: string) => void;
}

export const TaskMessageCard: React.FC<TaskMessageCardProps> = ({
  task,
  onToggleStatus,
  onNavigateSection,
}) => {
  const isDone = task?.status === 'DONE';
  const isInProgress = task?.status === 'IN_PROGRESS';
  const title = task?.title || 'Trip Task';
  const assigneeName = task?.assignedTo?.name || '';
  const priority = (task?.priority || 'MEDIUM').toUpperCase();

  const priorityColor =
    priority === 'HIGH'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      : priority === 'LOW'
      ? 'bg-slate-700/50 text-slate-300 border-slate-600'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStatus && task?._id) {
      onToggleStatus(task._id, task.status || 'TODO');
    }
  };

  return (
    <div
      onClick={() => onNavigateSection && onNavigateSection('tasks')}
      className="bg-[#1e262c] border border-slate-700/80 hover:border-amber-500/40 rounded-2xl p-3 sm:p-3.5 cursor-pointer transition-all shadow-md flex flex-col space-y-2.5 w-full max-w-[280px] sm:max-w-[320px] text-left group"
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
          <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
          <span className="tracking-wide uppercase text-[10px] font-extrabold">Task</span>
        </div>
        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${priorityColor}`}>
          {priority}
        </span>
      </div>

      {/* Task Content Row with Interactive Checkbox */}
      <div className="flex items-start gap-2.5 min-w-0">
        <button
          type="button"
          onClick={handleToggle}
          className="mt-0.5 p-1 -m-1 text-slate-400 hover:text-white rounded-lg transition-transform active:scale-90 flex-shrink-0"
          title="Toggle completion status"
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : isInProgress ? (
            <Clock className="w-5 h-5 text-amber-400" />
          ) : (
            <Circle className="w-5 h-5 text-slate-400 hover:text-slate-200" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h4
            className={`font-bold text-sm leading-snug truncate transition-all ${
              isDone ? 'line-through text-slate-400' : 'text-white group-hover:text-amber-200'
            }`}
          >
            {title}
          </h4>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
            {assigneeName && (
              <span className="flex items-center gap-1 text-slate-300">
                <User className="w-3 h-3 text-slate-500" />
                <span className="truncate max-w-[100px]">{assigneeName}</span>
              </span>
            )}
            <span className={`font-semibold ${isDone ? 'text-emerald-400' : isInProgress ? 'text-amber-400' : 'text-slate-400'}`}>
              • {isDone ? 'Completed' : isInProgress ? 'In Progress' : 'To Do'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="pt-1 border-t border-slate-700/40 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:underline">
        <span>View all tasks</span>
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
};

// ============================================================================
// 6. POLL MESSAGE CARD
// ============================================================================
export interface PollMessageCardProps {
  poll: any;
  currentUserId?: string;
  onVotePoll?: (pollId: string, optionId: string) => void;
  onNavigateSection?: (section: string) => void;
}

export const PollMessageCard: React.FC<PollMessageCardProps> = ({
  poll,
  currentUserId,
  onVotePoll,
  onNavigateSection,
}) => {
  const question = poll?.question || 'Trip Poll';
  const options = poll?.options || [];

  // Compute total votes
  const totalVotes = options.reduce((sum: number, opt: any) => sum + (opt.votes?.length || 0), 0);

  const handleOptionVote = (optId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onVotePoll && poll?._id) {
      onVotePoll(poll._id, optId);
    }
  };

  return (
    <div
      onClick={() => onNavigateSection && onNavigateSection('polls')}
      className="bg-[#1e262c] border border-slate-700/80 hover:border-rose-500/40 rounded-2xl p-3 sm:p-3.5 cursor-pointer transition-all shadow-md flex flex-col space-y-2.5 w-full max-w-[280px] sm:max-w-[320px] text-left group"
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
          <Vote className="w-3.5 h-3.5 text-rose-400" />
          <span className="tracking-wide uppercase text-[10px] font-extrabold">Group Poll</span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      {/* Poll Question */}
      <h4 className="font-bold text-sm text-white group-hover:text-rose-200 transition-colors leading-snug">
        {question}
      </h4>

      {/* Options List Preview */}
      <div className="space-y-1.5">
        {options.slice(0, 3).map((opt: any) => {
          const voteCount = opt.votes?.length || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const hasVotedThis = currentUserId
            ? opt.votes?.some((v: any) => String(v._id || v) === String(currentUserId))
            : false;

          return (
            <button
              key={opt._id}
              type="button"
              onClick={(e) => handleOptionVote(opt._id, e)}
              className={`w-full text-left p-2 rounded-xl relative overflow-hidden text-xs font-medium flex items-center justify-between transition-all border ${
                hasVotedThis
                  ? 'bg-rose-500/15 border-rose-500/40 text-white font-bold'
                  : 'bg-black/20 hover:bg-black/35 border-white/5 text-slate-200'
              }`}
            >
              {/* Progress bar background fill */}
              {totalVotes > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-rose-500/20 pointer-events-none transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              )}

              <span className="relative z-10 truncate pr-2 flex items-center gap-1.5">
                {hasVotedThis ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                )}
                <span className="truncate">{opt.text}</span>
              </span>

              <span className="relative z-10 text-[10px] font-mono text-slate-400 flex-shrink-0">
                {percentage}%
              </span>
            </button>
          );
        })}

        {options.length > 3 && (
          <p className="text-[10px] text-slate-400 text-center pt-0.5">
            + {options.length - 3} more {options.length - 3 === 1 ? 'option' : 'options'}
          </p>
        )}
      </div>

      {/* Bottom Action */}
      <div className="pt-1 border-t border-slate-700/40 flex items-center justify-between text-xs font-bold text-rose-400 group-hover:underline">
        <span>View poll details</span>
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
};
