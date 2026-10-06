import React, { useRef, useEffect, useState } from 'react';
import { ExpenseMessageCard } from './ExpenseMessageCard';
import {
  Calendar, Ticket, CheckSquare, Vote, FileText,
  ChevronRight, Clock, MapPin, CheckCircle2, Circle
} from 'lucide-react';

interface ActivityFeedProps {
  activities: any[];
  expenses: any[];
  itinerary: any[];
  bookings: any[];
  tasks: any[];
  polls: any[];
  documents: any[];
  members: any[];
  currentUser: any;
  onSelectExpense: (exp: any) => void;
  onEditExpense?: (exp: any) => void;
  onDeleteExpense?: (id: string, e: React.MouseEvent) => void;
  onPayExpenseSplit?: (exp: any, userShare: number, payerName: string) => void;
  onVotePoll?: (pollId: string, optionId: string) => void;
  onToggleTaskStatus?: (taskId: string, currentStatus: string) => void;
  onNavigateSection?: (section: string) => void;
}

// Assign consistent colors to member names for WhatsApp group chat feel
const MEMBER_COLORS = [
  'text-emerald-400',
  'text-amber-400',
  'text-cyan-400',
  'text-rose-400',
  'text-purple-400',
  'text-indigo-400',
  'text-teal-400',
  'text-orange-400'
];

const getMemberColor = (name: string = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % MEMBER_COLORS.length;
  return MEMBER_COLORS[index];
};

// WhatsApp-style Status Ticks for outgoing messages
const MessageTicks: React.FC<{ act: any; isSelf: boolean }> = ({ act, isSelf }) => {
  if (!isSelf) return null;

  if (act.isPending) {
    return <Clock className="w-3 h-3 text-slate-400 inline ml-1 animate-pulse" />;
  }

  const status = act.status || 'SENT';
  const readBy = act.readBy || [];

  if (status === 'READ' || readBy.length > 0) {
    return <span className="text-cyan-400 font-bold ml-1 text-xs select-none" title="Read">✓✓</span>;
  }

  if (status === 'DELIVERED') {
    return <span className="text-slate-400 font-bold ml-1 text-xs select-none" title="Delivered">✓✓</span>;
  }

  return <span className="text-slate-400 font-bold ml-1 text-xs select-none" title="Sent">✓</span>;
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities = [],
  expenses = [],
  itinerary = [],
  bookings = [],
  tasks = [],
  polls = [],
  documents = [],
  members = [],
  currentUser,
  onSelectExpense,
  onEditExpense,
  onDeleteExpense,
  onPayExpenseSplit,
  onVotePoll,
  onToggleTaskStatus,
  onNavigateSection,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [unreadNewMessages, setUnreadNewMessages] = useState<number>(0);
  const [isNearBottom, setIsNearBottom] = useState<boolean>(true);

  // Monitor container scroll position to handle "New Messages" indicator
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const near = distanceFromBottom < 150;
    setIsNearBottom(near);
    if (near) {
      setUnreadNewMessages(0);
    }
  };

  // Auto scroll to bottom if near bottom when new messages arrive; otherwise increment new message counter
  useEffect(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    if (distanceFromBottom < 200 || isNearBottom) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadNewMessages(0);
    } else {
      setUnreadNewMessages((prev: number) => prev + 1);
    }
  }, [activities.length]);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadNewMessages(0);
    setIsNearBottom(true);
  };

  // Format date headers like WhatsApp: TODAY, YESTERDAY, 30 SEPTEMBER 2026
  const formatDateHeader = (dateObj: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateObj.toDateString() === today.toDateString()) {
      return 'TODAY';
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      return 'YESTERDAY';
    } else {
      return dateObj.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).toUpperCase();
    }
  };

  // Build combined chronological items list
  const combinedStream: any[] = [];
  const processedKeys = new Set<string>();

  // Add all activity records
  activities.forEach((act) => {
    const key = `act-${act._id}`;
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      combinedStream.push({
        type: 'ACTIVITY',
        timestamp: new Date(act.createdAt || Date.now()),
        data: act
      });
    }
  });

  // Sort combined stream chronologically (oldest to newest)
  combinedStream.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Group stream items by date header
  const groupedItems: { dateLabel: string; items: any[] }[] = [];
  let currentDateLabel = '';

  combinedStream.forEach((item) => {
    const label = formatDateHeader(item.timestamp);
    if (label !== currentDateLabel) {
      currentDateLabel = label;
      groupedItems.push({ dateLabel: label, items: [item] });
    } else {
      groupedItems[groupedItems.length - 1].items.push(item);
    }
  });

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4 pb-6 relative"
      style={{
        backgroundColor: '#0b141a',
        backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }}
    >
      {combinedStream.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-emerald-400 shadow-md">
            💬
          </div>
          <p className="text-sm font-semibold text-slate-300">Welcome to the Trip Group Chat!</p>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Send messages, add expenses, itinerary items, or bookings using the <strong>+</strong> button below.
          </p>
        </div>
      ) : (
        groupedItems.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-3">
            {/* WhatsApp Centered Date Separator Pill */}
            <div className="flex items-center justify-center my-3">
              <span className="bg-[#182229] border border-slate-800 text-slate-400 text-[11px] font-bold px-3 py-1 rounded-md tracking-wider shadow-sm">
                {group.dateLabel}
              </span>
            </div>

            {/* Group Items */}
            {group.items.map((streamItem, i) => {
              const act = streamItem.data;
              const sender = act.userId || {};
              const senderId = sender._id || sender.id;
              const isSelf = currentUser && (senderId === currentUser._id || senderId === currentUser.id);
              const senderName = sender.name || 'Member';
              const nameColor = getMemberColor(senderName);
              const timeStr = new Date(streamItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              const actType = act.type || '';
              const isSystemMessage = actType.includes('JOIN') || actType.includes('LEAVE') || actType === 'TRIP_CREATED';

              // System Message Bubble (e.g. "Bilal joined the trip")
              if (isSystemMessage) {
                return (
                  <div key={act._id || i} className="flex justify-center my-1.5">
                    <div className="bg-[#182229]/90 border border-slate-800/80 px-3 py-1 rounded-lg text-[11px] text-slate-400 font-medium shadow-sm flex items-center gap-1.5">
                      <span>{act.description}</span>
                      <span className="text-[10px] text-slate-500">• {timeStr}</span>
                    </div>
                  </div>
                );
              }

              // Check for related expense card
              const targetExpId = act.metadata?.expenseId || act.metadata?.expense?._id;
              const relatedExpense = targetExpId
                ? (expenses.find((e) => String(e._id) === String(targetExpId)) || act.metadata?.expense)
                : (actType === 'EXPENSE_ADDED' || actType === 'EXPENSE_UPDATED' || actType === 'EXPENSE_SPLIT_PAID' ? act.metadata?.expense : null);

              // Check for related itinerary item
              const relatedItineraryId = act.metadata?.itineraryId;
              const relatedItinerary = relatedItineraryId ? itinerary.find((it) => String(it._id) === String(relatedItineraryId)) : null;

              // Check for related booking
              const relatedBookingId = act.metadata?.bookingId;
              const relatedBooking = relatedBookingId ? bookings.find((b) => String(b._id) === String(relatedBookingId)) : null;

              // Check for related task
              const relatedTaskId = act.metadata?.taskId;
              const relatedTask = relatedTaskId ? tasks.find((t) => String(t._id) === String(relatedTaskId)) : null;

              // Check for related poll
              const relatedPollId = act.metadata?.pollId;
              const relatedPoll = relatedPollId ? polls.find((p) => String(p._id) === String(relatedPollId)) : null;

              // Check for related document
              const relatedDocId = act.metadata?.documentId;
              const relatedDoc = relatedDocId ? documents.find((d) => String(d._id) === String(relatedDocId)) : null;

              // Helper to extract amount from text description if expense object/metadata amount is missing
              const extractAmountFromDescription = (desc: string = ''): number => {
                const match = desc.match(/₹\s*([\d,]+(?:\.\d+)?)/);
                if (match && match[1]) {
                  const parsed = parseFloat(match[1].replace(/,/g, ''));
                  return isNaN(parsed) ? 0 : parsed;
                }
                return 0;
              };

              const fallbackAmount = relatedExpense?.amount
                || act.metadata?.amount
                || act.metadata?.expense?.amount
                || extractAmountFromDescription(act.description);

              return (
                <div
                  key={act._id || i}
                  className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} my-1.5 animate-in fade-in duration-150`}
                >
                  {/* Message Bubble Container */}
                  <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%]`}>

                    {/* EXPENSE / PAYMENT MESSAGE CARD (Google Pay Inspired) */}
                    {actType === 'EXPENSE_ADDED' || actType === 'EXPENSE_SPLIT_PAID' || relatedExpense ? (
                      <div className="space-y-1">
                        {!isSelf && (
                          <span className={`text-xs font-bold ${nameColor} px-1 block`}>
                            {senderName}
                          </span>
                        )}
                        <ExpenseMessageCard
                          expense={relatedExpense || act.metadata?.expense || {
                            _id: targetExpId,
                            title: act.metadata?.title || act.description || 'Expense',
                            amount: fallbackAmount,
                            category: act.metadata?.category || 'Miscellaneous',
                            paidBy: sender,
                            date: streamItem.timestamp,
                            participants: []
                          }}
                          members={members}
                          currentUser={currentUser}
                          onSelect={onSelectExpense}
                          onEdit={onEditExpense}
                          onDelete={onDeleteExpense}
                          onPaySplit={onPayExpenseSplit}
                        />
                        <div className={`text-[10px] text-slate-400 text-right px-1 pt-0.5`}>
                          {timeStr}
                        </div>
                      </div>
                    ) : relatedItinerary ? (
                      /* ITINERARY ATTACHMENT CARD */
                      <div className={`rounded-2xl p-3.5 shadow-md border ${
                        isSelf ? 'bg-[#005c4b] border-emerald-700/60 text-white' : 'bg-[#202c33] border-slate-700/80 text-slate-100'
                      }`}>
                        {!isSelf && <p className={`text-xs font-bold ${nameColor} mb-1.5`}>{senderName}</p>}
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 mb-1">
                          <Calendar className="w-4 h-4 text-cyan-400" />
                          <span>📅 Itinerary</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">{relatedItinerary.title}</h4>
                        {relatedItinerary.location && (
                          <p className="text-xs text-slate-200 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-rose-400" />
                            <span>{relatedItinerary.location}</span>
                          </p>
                        )}
                        <p className="text-[11px] text-slate-300 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-cyan-300" />
                          <span>{relatedItinerary.startTime || 'Scheduled time'}</span>
                        </p>
                        {onNavigateSection && (
                          <button
                            onClick={() => onNavigateSection('itinerary')}
                            className="mt-2.5 pt-2 border-t border-white/10 w-full flex items-center justify-between text-xs font-bold text-cyan-300 hover:underline"
                          >
                            <span>View itinerary</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="block text-[10px] text-slate-300 text-right mt-1">{timeStr}</span>
                      </div>
                    ) : relatedBooking ? (
                      /* BOOKING ATTACHMENT CARD */
                      <div className={`rounded-2xl p-3.5 shadow-md border ${
                        isSelf ? 'bg-[#005c4b] border-emerald-700/60 text-white' : 'bg-[#202c33] border-slate-700/80 text-slate-100'
                      }`}>
                        {!isSelf && <p className={`text-xs font-bold ${nameColor} mb-1.5`}>{senderName}</p>}
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1">
                          <Ticket className="w-4 h-4 text-amber-400" />
                          <span>🏨 Booking</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">{relatedBooking.provider || relatedBooking.type}</h4>
                        <p className="text-xs text-slate-200 mt-0.5">{relatedBooking.notes || relatedBooking.location || 'Booking Confirmed'}</p>
                        {relatedBooking.cost > 0 && (
                          <p className="text-xs font-bold text-amber-300 mt-1">₹{relatedBooking.cost.toLocaleString()}</p>
                        )}
                        {onNavigateSection && (
                          <button
                            onClick={() => onNavigateSection('bookings')}
                            className="mt-2.5 pt-2 border-t border-white/10 w-full flex items-center justify-between text-xs font-bold text-amber-300 hover:underline"
                          >
                            <span>View booking</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="block text-[10px] text-slate-300 text-right mt-1">{timeStr}</span>
                      </div>
                    ) : relatedTask ? (
                      /* TASK ATTACHMENT CARD */
                      <div className={`rounded-2xl p-3.5 shadow-md border ${
                        isSelf ? 'bg-[#005c4b] border-emerald-700/60 text-white' : 'bg-[#202c33] border-slate-700/80 text-slate-100'
                      }`}>
                        {!isSelf && <p className={`text-xs font-bold ${nameColor} mb-1.5`}>{senderName}</p>}
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1">
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                          <span>✓ Task</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">{relatedTask.title}</h4>
                        <p className="text-xs text-slate-200 mt-0.5">
                          Status: <span className="font-bold text-emerald-300">{relatedTask.status}</span>
                        </p>
                        {onNavigateSection && (
                          <button
                            onClick={() => onNavigateSection('tasks')}
                            className="mt-2.5 pt-2 border-t border-white/10 w-full flex items-center justify-between text-xs font-bold text-amber-300 hover:underline"
                          >
                            <span>View tasks</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="block text-[10px] text-slate-300 text-right mt-1">{timeStr}</span>
                      </div>
                    ) : relatedPoll ? (
                      /* POLL ATTACHMENT CARD */
                      <div className={`rounded-2xl p-3.5 shadow-md border ${
                        isSelf ? 'bg-[#005c4b] border-emerald-700/60 text-white' : 'bg-[#202c33] border-slate-700/80 text-slate-100'
                      }`}>
                        {!isSelf && <p className={`text-xs font-bold ${nameColor} mb-1.5`}>{senderName}</p>}
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-300 mb-1">
                          <Vote className="w-4 h-4 text-rose-400" />
                          <span>📊 Group Poll</span>
                        </div>
                        <h4 className="font-bold text-sm text-white mb-2">{relatedPoll.question}</h4>
                        <div className="space-y-1.5">
                          {relatedPoll.options?.map((opt: any) => (
                            <button
                              key={opt._id}
                              onClick={() => onVotePoll && onVotePoll(relatedPoll._id, opt._id)}
                              className="w-full text-left p-2 rounded-xl bg-black/20 hover:bg-black/40 border border-white/10 text-xs font-medium flex items-center justify-between transition-colors"
                            >
                              <span>{opt.text}</span>
                              <Circle className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          ))}
                        </div>
                        <span className="block text-[10px] text-slate-300 text-right mt-2">{timeStr}</span>
                      </div>
                    ) : relatedDoc ? (
                      /* DOCUMENT ATTACHMENT CARD */
                      <div className={`rounded-2xl p-3.5 shadow-md border ${
                        isSelf ? 'bg-[#005c4b] border-emerald-700/60 text-white' : 'bg-[#202c33] border-slate-700/80 text-slate-100'
                      }`}>
                        {!isSelf && <p className={`text-xs font-bold ${nameColor} mb-1.5`}>{senderName}</p>}
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-300 mb-1">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>📄 Document</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">{relatedDoc.name}</h4>
                        <p className="text-xs text-slate-200 mt-0.5">{relatedDoc.fileSize || 'Attachment'}</p>
                        {onNavigateSection && (
                          <button
                            onClick={() => onNavigateSection('documents')}
                            className="mt-2.5 pt-2 border-t border-white/10 w-full flex items-center justify-between text-xs font-bold text-blue-300 hover:underline"
                          >
                            <span>View document</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="block text-[10px] text-slate-300 text-right mt-1">{timeStr}</span>
                      </div>
                    ) : (
                      /* REGULAR TEXT CHAT MESSAGE BUBBLE */
                      <div className={`rounded-2xl px-3.5 py-2.5 shadow-md border ${
                        isSelf
                          ? 'bg-[#005c4b] border-emerald-700/50 text-slate-100 rounded-tr-none'
                          : 'bg-[#202c33] border-slate-700/60 text-slate-100 rounded-tl-none'
                      }`}>
                        {!isSelf && (
                          <span className={`text-xs font-bold ${nameColor} block mb-0.5`}>
                            {senderName}
                          </span>
                        )}
                        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {act.description}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-300 mt-1 font-normal opacity-90 select-none">
                          <span>{timeStr}</span>
                          <MessageTicks act={act} isSelf={isSelf} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Floating New Messages Indicator Button */}
      {unreadNewMessages > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed bottom-20 right-6 z-40 bg-[#00a884] hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 animate-bounce border border-emerald-400/40"
        >
          <span>↓ {unreadNewMessages} new {unreadNewMessages === 1 ? 'message' : 'messages'}</span>
        </button>
      )}

      <div ref={chatBottomRef} />
    </div>
  );
};
