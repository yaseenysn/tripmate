import React, { useRef, useEffect, useState } from 'react';
import { ExpenseMessageCard } from './ExpenseMessageCard';
import {
  PhotoMessageCard,
  DocumentMessageCard,
  ItineraryMessageCard,
  BookingMessageCard,
  TaskMessageCard,
  PollMessageCard,
} from './TripActivityCards';
import { ImagePreviewModal } from './ImagePreviewModal';
import { Clock } from 'lucide-react';
import { format12HourTime } from '../utils/timeFormat';

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
  tripId?: string;
  isLoading?: boolean;
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
  tripId,
  isLoading = false,
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
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    title: string;
    uploader?: string;
    date?: any;
    size?: string;
  } | null>(null);

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

  // Set of poll IDs that already have an explicit POLL_CREATED activity
  const pollIdsWithCreatedActivity = new Set(
    activities
      .filter((a) => a.type === 'POLL_CREATED')
      .map((a) => String(a.metadata?.pollId || a.metadata?.poll?._id || ''))
      .filter(Boolean)
  );
  const pollIdsRepresentedInStream = new Set<string>();

  // Add all activity records (excluding split payment and repeated vote activities to update cards in place)
  activities.forEach((act) => {
    if (act.type === 'EXPENSE_SPLIT_PAID') {
      return;
    }
    if (act.type === 'POLL_VOTED') {
      const pId = String(act.metadata?.pollId || act.metadata?.poll?._id || '');
      // If a POLL_CREATED activity already exists, suppress vote activity from creating separate feed items
      if (pollIdsWithCreatedActivity.has(pId)) {
        return;
      }
      // If historical activities only have POLL_VOTED, keep at most 1 representative entry to render the card
      if (pId && pollIdsRepresentedInStream.has(pId)) {
        return;
      }
      if (pId) {
        pollIdsRepresentedInStream.add(pId);
      }
    }
    if (tripId) {
      const actTripId = String(act.tripId?._id || act.tripId || '').trim();
      if (actTripId && actTripId !== String(tripId).trim()) {
        return;
      }
    }
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

  const renderedExpenseIds = new Set<string>();
  const renderedDocIds = new Set<string>();
  const renderedItineraryIds = new Set<string>();
  const renderedBookingIds = new Set<string>();
  const renderedTaskIds = new Set<string>();
  const renderedPollIds = new Set<string>();
  const renderedJoinUserIds = new Set<string>();

  const extractQuoted = (desc: string = ''): string => {
    const match = desc.match(/['"“]([^'"”]+)['"”]/);
    return match ? match[1].trim() : '';
  };

  const isImageFile = (filename: string = '', mimeType: string = '', docType: string = '') => {
    if (docType === 'PHOTO') return true;
    if (mimeType && mimeType.startsWith('image/')) return true;
    return /\.(png|jpe?g|webp|gif|svg|bmp|heic)$/i.test(filename || '');
  };

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
      {isLoading && combinedStream.length === 0 ? (
        <div className="space-y-4 py-4 animate-pulse select-none">
          {/* Centered Date Pill Skeleton */}
          <div className="flex items-center justify-center my-3">
            <div className="w-24 h-6 bg-slate-800/80 rounded-md border border-slate-700/50" />
          </div>

          {/* Incoming Message Skeleton */}
          <div className="flex justify-start">
            <div className="w-60 sm:w-72 bg-[#202c33]/70 rounded-2xl rounded-tl-sm p-3.5 border border-slate-800/80 space-y-2">
              <div className="w-20 h-3 bg-slate-700/60 rounded" />
              <div className="w-48 h-3.5 bg-slate-700/40 rounded" />
              <div className="w-32 h-3.5 bg-slate-700/40 rounded" />
            </div>
          </div>

          {/* Outgoing Message Skeleton */}
          <div className="flex justify-end">
            <div className="w-52 sm:w-64 bg-[#005c4b]/50 rounded-2xl rounded-tr-sm p-3.5 border border-emerald-900/40 space-y-2">
              <div className="w-40 h-3.5 bg-emerald-800/40 rounded" />
              <div className="w-28 h-3 bg-emerald-800/30 rounded" />
            </div>
          </div>

          {/* Incoming Message Skeleton 2 */}
          <div className="flex justify-start">
            <div className="w-48 sm:w-56 bg-[#202c33]/70 rounded-2xl rounded-tl-sm p-3 border border-slate-800/80 space-y-2">
              <div className="w-16 h-3 bg-slate-700/60 rounded" />
              <div className="w-36 h-3.5 bg-slate-700/40 rounded" />
            </div>
          </div>

          {/* Centered Loading Indicator */}
          <div className="flex justify-center py-4">
            <div className="bg-[#182229] border border-slate-800/80 px-4 py-2 rounded-full text-xs text-slate-300 font-medium shadow-md flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading chat messages...</span>
            </div>
          </div>
        </div>
      ) : combinedStream.length === 0 ? (
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
              if (act._id) {
                console.log(`[RTCHAT] MESSAGE_RENDERED activityId=${act._id}`);
              }
              const sender = act.userId || {};
              const senderId = sender._id || sender.id;
              const isSelf = currentUser && (senderId === currentUser._id || senderId === currentUser.id);
              const senderName = sender.name || 'Member';
              const nameColor = getMemberColor(senderName);
              const timeStr = format12HourTime(streamItem.timestamp);

              const actType = act.type || '';
              const isSystemMessage =
                actType.includes('JOIN') ||
                actType.includes('LEAVE') ||
                actType === 'TRIP_CREATED' ||
                actType === 'TRIP_UPDATED' ||
                actType === 'EXPENSE_DELETED';

              // System Message Bubble (e.g. "Ibrahim joined the trip · 10:29 PM")
              if (isSystemMessage) {
                let systemText = act.description || '';
                if (actType.includes('JOIN') || actType === 'MEMBER_JOINED') {
                  const joinKey = String(senderId || act.userId?._id || act.userId || act.description);
                  if (renderedJoinUserIds.has(joinKey)) {
                    return null;
                  }
                  renderedJoinUserIds.add(joinKey);
                  const memberName = act.userId?.name || act.metadata?.userName || (senderName !== 'Member' ? senderName : '') || 'A new member';
                  systemText = `${memberName} joined the trip`;
                } else if (actType.includes('LEAVE') || actType === 'MEMBER_LEFT') {
                  const memberName = act.userId?.name || act.metadata?.userName || (senderName !== 'Member' ? senderName : '') || 'A member';
                  systemText = `${memberName} left the trip`;
                } else if (actType === 'MEMBER_REMOVED') {
                  const memberName = act.metadata?.removedUserName || act.userId?.name || 'A member';
                  systemText = `${memberName} was removed from the trip`;
                }

                return (
                  <div key={act._id || i} className="flex justify-center my-1.5">
                    <div className="bg-[#182229]/90 border border-slate-800/80 px-3 py-1.5 rounded-lg text-[11px] text-slate-300 font-medium shadow-sm flex items-center gap-1.5 select-none">
                      <span>{systemText}</span>
                      <span className="text-slate-500 font-semibold">·</span>
                      <span className="text-[10px] text-slate-400">{timeStr}</span>
                    </div>
                  </div>
                );
              }

              // Check for related expense card - MUST resolve against active expenses list
              const targetExpId = act.metadata?.expenseId || act.metadata?.expense?._id;
              const relatedExpense = targetExpId
                ? expenses.find((e) => String(e._id) === String(targetExpId))
                : null;

              // If an activity was an expense addition/update but the expense was deleted, omit it completely
              if ((actType === 'EXPENSE_ADDED' || actType === 'EXPENSE_UPDATED') && !relatedExpense) {
                return null;
              }

              const stableExpId = String(relatedExpense?._id || '');
              const isExpenseCardCandidate = Boolean(relatedExpense) && actType !== 'EXPENSE_UPDATED';
              const shouldRenderExpenseCard = Boolean(isExpenseCardCandidate && stableExpId && !renderedExpenseIds.has(stableExpId));

              if (shouldRenderExpenseCard) {
                renderedExpenseIds.add(stableExpId);
              }

              // Document / Photo resolution
              const isDocOrPhotoAct = actType === 'DOCUMENT_UPLOADED' || actType === 'PHOTO_UPLOADED' || act.metadata?.documentId || act.metadata?.document || /uploaded (document|photo|image)/i.test(act.description || '');

              let relatedDoc: any = null;
              let isDocOrPhoto = false;
              let isPhoto = false;

              if (isDocOrPhotoAct) {
                isDocOrPhoto = true;
                const targetDocId = act.metadata?.documentId || act.metadata?.document?._id;
                const quoted = extractQuoted(act.description);
                relatedDoc = targetDocId
                  ? documents.find((d) => String(d._id) === String(targetDocId))
                  : quoted
                  ? documents.find((d) => d.name?.toLowerCase().includes(quoted.toLowerCase()))
                  : null;

                if (!relatedDoc && act.metadata?.document) {
                  relatedDoc = act.metadata.document;
                }

                if (!relatedDoc) {
                  relatedDoc = {
                    _id: targetDocId || `doc-fallback-${act._id}`,
                    name: quoted || 'Attachment',
                    type: actType === 'PHOTO_UPLOADED' || /photo|image/i.test(act.description || '') ? 'PHOTO' : 'DOCUMENT',
                    fileUrl: act.metadata?.fileUrl || '',
                    fileSize: act.metadata?.fileSize || '',
                    uploadedBy: sender,
                    createdAt: act.createdAt
                  };
                }

                isPhoto = isImageFile(relatedDoc.name, '', relatedDoc.type) || actType === 'PHOTO_UPLOADED';
              }

              // Itinerary resolution
              const isItineraryAct = actType === 'ITINERARY_ADDED' || actType === 'ITINERARY_UPDATED' || act.metadata?.itineraryId || act.metadata?.itinerary || /itinerary item/i.test(act.description || '');

              let relatedItinerary: any = null;
              if (isItineraryAct) {
                const targetItinId = act.metadata?.itineraryId || act.metadata?.itinerary?._id;
                const quoted = extractQuoted(act.description);
                relatedItinerary = targetItinId
                  ? itinerary.find((it) => String(it._id) === String(targetItinId))
                  : quoted
                  ? itinerary.find((it) => it.title?.toLowerCase().includes(quoted.toLowerCase()))
                  : null;

                if (!relatedItinerary && act.metadata?.itinerary) {
                  relatedItinerary = act.metadata.itinerary;
                }

                if (!relatedItinerary) {
                  const dayMatch = (act.description || '').match(/Day\s*(\d+)/i);
                  relatedItinerary = {
                    _id: targetItinId || `itin-fallback-${act._id}`,
                    title: quoted || 'Itinerary Event',
                    dayNumber: dayMatch ? parseInt(dayMatch[1], 10) : 1
                  };
                }
              }

              // Booking resolution
              const isBookingAct = actType === 'BOOKING_ADDED' || actType === 'BOOKING_UPDATED' || act.metadata?.bookingId || act.metadata?.booking || /booking/i.test(act.description || '');

              let relatedBooking: any = null;
              if (isBookingAct) {
                const targetBookingId = act.metadata?.bookingId || act.metadata?.booking?._id;
                const quoted = extractQuoted(act.description);
                relatedBooking = targetBookingId
                  ? bookings.find((b) => String(b._id) === String(targetBookingId))
                  : quoted
                  ? bookings.find((b) => (b.provider && b.provider.toLowerCase().includes(quoted.toLowerCase())) || (b.type && b.type.toLowerCase().includes(quoted.toLowerCase())))
                  : null;

                if (!relatedBooking && act.metadata?.booking) {
                  relatedBooking = act.metadata.booking;
                }

                if (!relatedBooking) {
                  relatedBooking = {
                    _id: targetBookingId || `booking-fallback-${act._id}`,
                    provider: quoted || 'Booking',
                    type: 'HOTEL'
                  };
                }
              }

              // Task resolution
              const isTaskAct = actType === 'TASK_ADDED' || actType === 'TASK_UPDATED' || act.metadata?.taskId || act.metadata?.task || /task/i.test(act.description || '');

              let relatedTask: any = null;
              if (isTaskAct) {
                const targetTaskId = act.metadata?.taskId || act.metadata?.task?._id;
                const quoted = extractQuoted(act.description);
                relatedTask = targetTaskId
                  ? tasks.find((t) => String(t._id) === String(targetTaskId))
                  : quoted
                  ? tasks.find((t) => t.title?.toLowerCase().includes(quoted.toLowerCase()))
                  : null;

                if (!relatedTask && act.metadata?.task) {
                  relatedTask = act.metadata.task;
                }

                if (!relatedTask) {
                  relatedTask = {
                    _id: targetTaskId || `task-fallback-${act._id}`,
                    title: quoted || 'Trip Task',
                    status: 'TODO',
                    priority: 'MEDIUM'
                  };
                }
              }

              // Poll resolution
              const isPollAct = actType === 'POLL_CREATED' || actType === 'POLL_VOTED' || act.metadata?.pollId || act.metadata?.poll || /poll/i.test(act.description || '');

              let relatedPoll: any = null;
              if (isPollAct) {
                const targetPollId = act.metadata?.pollId || act.metadata?.poll?._id;
                const quoted = extractQuoted(act.description);
                relatedPoll = targetPollId
                  ? polls.find((p) => String(p._id) === String(targetPollId))
                  : quoted
                  ? polls.find((p) => p.question?.toLowerCase().includes(quoted.toLowerCase()))
                  : null;

                if (!relatedPoll && act.metadata?.poll) {
                  relatedPoll = act.metadata.poll;
                }

                if (!relatedPoll) {
                  relatedPoll = {
                    _id: targetPollId || `poll-fallback-${act._id}`,
                    question: quoted || 'Group Poll',
                    options: []
                  };
                }
              }

              // Check if this is an update activity or a duplicate card in the feed
              const isUpdateActivity = actType === 'POLL_VOTED' || actType === 'TASK_UPDATED' || actType === 'ITINERARY_UPDATED' || actType === 'BOOKING_UPDATED';

              const docIdStr = String(relatedDoc?._id || '');
              const itinIdStr = String(relatedItinerary?._id || '');
              const bookingIdStr = String(relatedBooking?._id || '');
              const taskIdStr = String(relatedTask?._id || '');
              const pollIdStr = String(relatedPoll?._id || '');

              const isDuplicateCard =
                (docIdStr && renderedDocIds.has(docIdStr)) ||
                (itinIdStr && renderedItineraryIds.has(itinIdStr)) ||
                (bookingIdStr && renderedBookingIds.has(bookingIdStr)) ||
                (taskIdStr && renderedTaskIds.has(taskIdStr)) ||
                (pollIdStr && renderedPollIds.has(pollIdStr));

              // Suppress poll vote activities from appending system pills to the chat
              if (actType === 'POLL_VOTED') {
                if (!renderedPollIds.has(pollIdStr) && relatedPoll) {
                  // If the poll card hasn't been rendered yet, let it proceed to render PollMessageCard
                } else {
                  return null;
                }
              }

              if ((isUpdateActivity || isDuplicateCard) && (relatedPoll || relatedTask || relatedItinerary || relatedBooking || relatedDoc) && !shouldRenderExpenseCard) {
                if (isDuplicateCard) {
                  return null;
                }
                return (
                  <div key={act._id || i} className="flex justify-center my-1.5">
                    <div className="bg-[#182229]/90 border border-slate-800/80 px-3 py-1.5 rounded-lg text-[11px] text-slate-300 font-medium shadow-sm flex items-center gap-1.5 select-none">
                      <span>{act.description}</span>
                      <span className="text-slate-500 font-semibold">·</span>
                      <span className="text-[10px] text-slate-400">{timeStr}</span>
                    </div>
                  </div>
                );
              }

              // Register ids in rendered sets
              if (docIdStr) renderedDocIds.add(docIdStr);
              if (itinIdStr) renderedItineraryIds.add(itinIdStr);
              if (bookingIdStr) renderedBookingIds.add(bookingIdStr);
              if (taskIdStr) renderedTaskIds.add(taskIdStr);
              if (pollIdStr) renderedPollIds.add(pollIdStr);

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
                    {shouldRenderExpenseCard ? (
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
                    ) : isDocOrPhoto && isPhoto ? (
                      /* PHOTO CARD */
                      <div className="space-y-1">
                        {!isSelf && (
                          <span className={`text-xs font-bold ${nameColor} px-1 block mb-1`}>
                            {senderName}
                          </span>
                        )}
                        <PhotoMessageCard
                          document={relatedDoc}
                          senderName={senderName}
                          timestamp={streamItem.timestamp}
                          isSelf={isSelf}
                          onOpenPreview={(photo) => setPreviewPhoto(photo)}
                        />
                        <div className="text-[10px] text-slate-400 text-right px-1 pt-0.5 flex items-center justify-end gap-1">
                          <span>{timeStr}</span>
                          <MessageTicks act={act} isSelf={isSelf} />
                        </div>
                      </div>
                    ) : isDocOrPhoto && !isPhoto ? (
                      /* DOCUMENT CARD */
                      <div className="space-y-1">
                        {!isSelf && (
                          <span className={`text-xs font-bold ${nameColor} px-1 block mb-1`}>
                            {senderName}
                          </span>
                        )}
                        <DocumentMessageCard
                          document={relatedDoc}
                          onNavigateSection={onNavigateSection}
                        />
                        <div className="text-[10px] text-slate-400 text-right px-1 pt-0.5 flex items-center justify-end gap-1">
                          <span>{timeStr}</span>
                          <MessageTicks act={act} isSelf={isSelf} />
                        </div>
                      </div>
                    ) : relatedItinerary ? (
                      /* ITINERARY CARD */
                      <div className="space-y-1">
                        {!isSelf && (
                          <span className={`text-xs font-bold ${nameColor} px-1 block mb-1`}>
                            {senderName}
                          </span>
                        )}
                        <ItineraryMessageCard
                          item={relatedItinerary}
                          onNavigateSection={onNavigateSection}
                        />
                        <div className="text-[10px] text-slate-400 text-right px-1 pt-0.5 flex items-center justify-end gap-1">
                          <span>{timeStr}</span>
                          <MessageTicks act={act} isSelf={isSelf} />
                        </div>
                      </div>
                    ) : relatedBooking ? (
                      /* BOOKING CARD */
                      <div className="space-y-1">
                        {!isSelf && (
                          <span className={`text-xs font-bold ${nameColor} px-1 block mb-1`}>
                            {senderName}
                          </span>
                        )}
                        <BookingMessageCard
                          booking={relatedBooking}
                          onNavigateSection={onNavigateSection}
                        />
                        <div className="text-[10px] text-slate-400 text-right px-1 pt-0.5 flex items-center justify-end gap-1">
                          <span>{timeStr}</span>
                          <MessageTicks act={act} isSelf={isSelf} />
                        </div>
                      </div>
                    ) : relatedTask ? (
                      /* TASK CARD */
                      <div className="space-y-1">
                        {!isSelf && (
                          <span className={`text-xs font-bold ${nameColor} px-1 block mb-1`}>
                            {senderName}
                          </span>
                        )}
                        <TaskMessageCard
                          task={relatedTask}
                          onToggleStatus={onToggleTaskStatus}
                          onNavigateSection={onNavigateSection}
                        />
                        <div className="text-[10px] text-slate-400 text-right px-1 pt-0.5 flex items-center justify-end gap-1">
                          <span>{timeStr}</span>
                          <MessageTicks act={act} isSelf={isSelf} />
                        </div>
                      </div>
                    ) : relatedPoll ? (
                      /* POLL CARD */
                      <div className="space-y-1">
                        {!isSelf && (
                          <span className={`text-xs font-bold ${nameColor} px-1 block mb-1`}>
                            {senderName}
                          </span>
                        )}
                        <PollMessageCard
                          poll={relatedPoll}
                          currentUserId={currentUser?._id || currentUser?.id}
                          onVotePoll={onVotePoll}
                          onNavigateSection={onNavigateSection}
                        />
                        <div className="text-[10px] text-slate-400 text-right px-1 pt-0.5 flex items-center justify-end gap-1">
                          <span>{timeStr}</span>
                          <MessageTicks act={act} isSelf={isSelf} />
                        </div>
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

      {/* Lightbox Image Preview Modal */}
      {previewPhoto && (
        <ImagePreviewModal
          photo={previewPhoto}
          onClose={() => setPreviewPhoto(null)}
        />
      )}

      <div ref={chatBottomRef} />
    </div>
  );
};
