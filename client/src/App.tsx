import React, { useState, useEffect } from 'react';
import { WhatsAppHeader } from './components/WhatsAppHeader';
import { TripListView } from './components/TripListView';
import { TripWorkspaceHeader } from './components/TripWorkspaceHeader';
import { PinnedTripSummary } from './components/PinnedTripSummary';
import { ActivityFeed } from './components/ActivityFeed';
import { TripInfoDrawer } from './components/TripInfoDrawer';
import { ExpenseDetailSheet } from './components/ExpenseDetailSheet';
import { QuickActionFab } from './components/QuickActionFab';
import { SettlementSheet } from './components/SettlementSheet';
import { NotificationsModal } from './components/NotificationsModal';
import { AddEditExpenseModal } from './components/AddEditExpenseModal';
import { PaySplitConfirmationModal } from './components/PaySplitConfirmationModal';

// Auth & Shell
import { AuthView } from './components/AuthView';
import { CreateTripModal } from './components/CreateTripModal';
import { JoinTripModal } from './components/JoinTripModal';
import { InviteModal } from './components/InviteModal';

// Feature Section Views (for detail drill-downs)
import { ExpensesView } from './components/ExpensesView';
import { ItineraryView } from './components/ItineraryView';
import { BookingsView } from './components/BookingsView';
import { TasksView } from './components/TasksView';
import { PollsView } from './components/PollsView';
import { DocumentsView } from './components/DocumentsView';
import { BudgetView } from './components/BudgetView';

import { JoinInviteConfirmationModal } from './components/JoinInviteConfirmationModal';
import { WhatsAppComposer } from './components/WhatsAppComposer';

// API & Socket
import {
  apiLogin, apiGetMe, apiGetTrips, apiGetTripDetails,
  apiGetExpenses, apiGetBudget, apiGetItinerary, apiGetBookings,
  apiGetSettlements, apiGetTasks, apiGetPolls,
  apiGetDocuments, apiGetActivity, apiGetNotifications,
  apiSendChatMessage,
  setAuthToken, removeAuthToken, getAuthToken,
  apiJoinWithToken, apiDeleteExpense, apiDeleteTrip
} from './services/api';
import { joinTripRoom, leaveTripRoom, getSocket } from './services/socket';
import { Compass, MessageSquare } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingJoinToken, setPendingJoinToken] = useState<string | null>(null);

  // Workspace State
  const [tripData, setTripData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [itinerary, setItinerary] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [settlementsData, setSettlementsData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Modals / Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTripInfo, setShowTripInfo] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<any>(null);
  const [showAddEditExpenseModal, setShowAddEditExpenseModal] = useState(false);
  const [paySplitInfo, setPaySplitInfo] = useState<{ expense: any; userShare: number; payerName: string } | null>(null);
  const [autoOpenModalCategory, setAutoOpenModalCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Verify JWT session on load
  const initializeAuth = async () => {
    try {
      const token = getAuthToken();
      if (token) {
        const meRes = await apiGetMe();
        setUser(meRes.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('Auth token verification failed:', err);
      removeAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeAuth();
  }, []);

  // Handle URL Join Token (e.g. /join/:token)
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/join/')) {
      const rawToken = path.split('/join/')[1];
      if (rawToken) {
        const cleanToken = rawToken.split('?')[0].split('#')[0].trim();
        if (cleanToken) {
          setPendingJoinToken(cleanToken);
        }
      }
    }
  }, []);

  // Load Trips
  const loadTrips = async () => {
    if (!user) return;
    try {
      const res = await apiGetTrips();
      const loadedTrips = res.trips || [];
      setTrips(loadedTrips);
      // Automatically select first trip on desktop if none selected
      if (!activeTripId && loadedTrips.length > 0 && window.innerWidth >= 768) {
        setActiveTripId(loadedTrips[0]._id);
      }
    } catch (err) {
      console.error('Error loading trips:', err);
    }
  };

  useEffect(() => {
    if (user) loadTrips();
  }, [user]);

  // Load Active Trip Workspace Payload
  const loadWorkspaceData = async (tId: string) => {
    try {
      const detailsRes = await apiGetTripDetails(tId);
      setTripData(detailsRes.trip);
      setMembers(detailsRes.members || []);

      const [expRes, budRes, itinRes, bookRes, setRes, taskRes, pollRes, docRes, actRes, notifRes] =
        await Promise.all([
          apiGetExpenses(tId),
          apiGetBudget(tId),
          apiGetItinerary(tId),
          apiGetBookings(tId),
          apiGetSettlements(tId),
          apiGetTasks(tId),
          apiGetPolls(tId),
          apiGetDocuments(tId),
          apiGetActivity(tId),
          apiGetNotifications().catch(() => ({ notifications: [] })),
        ]);

      setExpenses(expRes.expenses || []);
      setBudgetData(budRes || null);
      setItinerary(itinRes.items || []);
      setBookings(bookRes.bookings || []);
      setSettlementsData(setRes || null);
      setTasks(taskRes.tasks || []);
      setPolls(pollRes.polls || []);
      setDocuments(docRes.documents || []);
      setActivities(actRes.activities || []);
      setNotifications(notifRes.notifications || []);
    } catch (err) {
      console.error('Error loading workspace:', err);
    }
  };

  useEffect(() => {
    if (activeTripId) {
      joinTripRoom(activeTripId);
      loadWorkspaceData(activeTripId);
      setActiveSection('feed');

      const socket = getSocket();

      // Realtime Activity / Message handler - Updates feed instantly without 10 HTTP requests!
      const handleActivityCreated = (newActivity: any) => {
        const receivedTime = Date.now();
        console.log(`[Chat] [Socket Event] Received activity.created for trip ${newActivity.tripId} at ${receivedTime}:`, newActivity);

        const targetTripId = newActivity.tripId?._id || newActivity.tripId;
        if (targetTripId !== activeTripId) return;

        setActivities((prev) => {
          const clientMsgId = newActivity.metadata?.clientMessageId;

          // Check if activity already exists or matches optimistic pending message
          const exists = prev.some((a) => {
            if (a._id === newActivity._id) return true;
            if (clientMsgId && (a.clientMessageId === clientMsgId || a.metadata?.clientMessageId === clientMsgId)) return true;
            if (a.isPending && a.description === newActivity.description) {
              const prevUser = a.userId?._id || a.userId?.id || a.userId;
              const newUser = newActivity.userId?._id || newActivity.userId?.id || newActivity.userId;
              if (prevUser === newUser) return true;
            }
            return false;
          });

          if (exists) {
            // Replace temporary/pending message with authoritative server activity
            return prev.map((a) => {
              if (
                a._id === newActivity._id ||
                (clientMsgId && (a.clientMessageId === clientMsgId || a.metadata?.clientMessageId === clientMsgId)) ||
                (a.isPending && a.description === newActivity.description)
              ) {
                return newActivity;
              }
              return a;
            });
          }

          // Otherwise append new activity directly
          return [...prev, newActivity];
        });
      };

      const handleWorkspaceSync = () => {
        // Sync non-chat features (Expenses, Itinerary, Bookings, Tasks, Polls, Settlements)
        loadWorkspaceData(activeTripId);
      };

      socket.on('activity.created', handleActivityCreated);
      socket.on('expense.created', handleWorkspaceSync);
      socket.on('expense.updated', handleWorkspaceSync);
      socket.on('expense.deleted', handleWorkspaceSync);
      socket.on('member.joined', handleWorkspaceSync);
      socket.on('member.removed', handleWorkspaceSync);
      socket.on('itinerary.created', handleWorkspaceSync);
      socket.on('itinerary.updated', handleWorkspaceSync);
      socket.on('booking.created', handleWorkspaceSync);
      socket.on('task.updated', handleWorkspaceSync);
      socket.on('poll.voted', handleWorkspaceSync);
      socket.on('settlement.updated', handleWorkspaceSync);

      return () => {
        leaveTripRoom(activeTripId);
        socket.off('activity.created', handleActivityCreated);
        socket.off('expense.created', handleWorkspaceSync);
        socket.off('expense.updated', handleWorkspaceSync);
        socket.off('expense.deleted', handleWorkspaceSync);
        socket.off('member.joined', handleWorkspaceSync);
        socket.off('member.removed', handleWorkspaceSync);
        socket.off('itinerary.created', handleWorkspaceSync);
        socket.off('itinerary.updated', handleWorkspaceSync);
        socket.off('booking.created', handleWorkspaceSync);
        socket.off('task.updated', handleWorkspaceSync);
        socket.off('poll.voted', handleWorkspaceSync);
        socket.off('settlement.updated', handleWorkspaceSync);
      };
    }
  }, [activeTripId]);

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
    setActiveTripId(null);
  };

  const handleTripCreated = (newTrip: any) => {
    loadTrips();
    setActiveTripId(newTrip._id);
    setActiveSection('feed');
  };

  const handleSendMessage = async (text: string) => {
    if (!activeTripId || !text.trim()) return;

    const startTime = Date.now();
    const clientMessageId = `temp_${startTime}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. OPTIMISTIC UI UPDATE - Sender sees message IMMEDIATELY (0ms delay!)
    const optimisticActivity = {
      _id: clientMessageId,
      clientMessageId,
      tripId: activeTripId,
      userId: user,
      type: 'CHAT_MESSAGE',
      description: text.trim(),
      metadata: { clientMessageId },
      createdAt: new Date().toISOString(),
      isPending: true,
    };

    console.log(`[Chat] [0ms] Send initiated. Adding optimistic message locally:`, clientMessageId);
    setActivities((prev) => [...prev, optimisticActivity]);

    // 2. Persistent API call in background
    try {
      const res = await apiSendChatMessage(activeTripId, text.trim(), clientMessageId);
      const elapsed = Date.now() - startTime;
      console.log(`[Chat] [${elapsed}ms] API response received for:`, clientMessageId, res.activity?._id);

      if (res.activity) {
        setActivities((prev) =>
          prev.map((a) =>
            a._id === clientMessageId || a.clientMessageId === clientMessageId
              ? res.activity
              : a
          )
        );
      }
    } catch (err) {
      console.error('[Chat] Error sending message via API:', err);
      setActivities((prev) =>
        prev.map((a) =>
          a._id === clientMessageId
            ? { ...a, isPending: false, isError: true }
            : a
        )
      );
    }
  };

  const handleSelectQuickAction = (
    actionType: 'PHOTO' | 'EXPENSE' | 'ITINERARY' | 'BOOKING' | 'TASK' | 'POLL' | 'DOCUMENT'
  ) => {
    const map: Record<string, string> = {
      PHOTO: 'documents',
      EXPENSE: 'expenses',
      ITINERARY: 'itinerary',
      BOOKING: 'bookings',
      TASK: 'tasks',
      POLL: 'polls',
      DOCUMENT: 'documents',
    };
    const target = map[actionType];
    if (target) {
      setActiveSection(target);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!activeTripId) return;
    try {
      await apiDeleteExpense(activeTripId, id);
      loadWorkspaceData(activeTripId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTripGroup = async () => {
    if (!activeTripId) return;
    try {
      await apiDeleteTrip(activeTripId);
      setActiveTripId(null);
      loadTrips();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wider">Loading TripMate...</span>
        </div>
      </div>
    );
  }

  // Protected Route: Render Login / Register if unauthenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center relative">
        {pendingJoinToken && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-3 text-center shadow-lg sticky top-0 z-50">
            🎉 You have been invited to join a TripMate group! Please sign in or create an account to view and accept your invitation.
          </div>
        )}
        <AuthView
          onAuthSuccess={(authUser) => {
            setUser(authUser);
            loadTrips();
          }}
        />
      </div>
    );
  }

  const isAdmin = tripData?.userRole === 'ADMIN';

  return (
    <div className="h-screen h-dvh max-h-screen max-h-dvh overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top App Header */}
      <WhatsAppHeader
        user={user}
        unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
        onLogout={handleLogout}
        onOpenCreateTrip={() => setShowCreateModal(true)}
        onOpenJoinTrip={() => setShowJoinModal(true)}
        onOpenNotifications={() => setShowNotifications(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main WhatsApp Web Inspired 2-Column Shell */}
      <div className="flex-1 min-h-0 flex overflow-hidden max-w-7xl w-full mx-auto">
        {/* Left Column: WhatsApp Chat List (Visible always on desktop, hidden on mobile if trip open) */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 min-h-0 h-full ${
            activeTripId ? 'hidden md:flex md:flex-col' : 'flex flex-col'
          }`}
        >
          <TripListView
            trips={trips}
            activeTripId={activeTripId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSelectTrip={(id) => {
              setActiveTripId(id);
              setActiveSection('feed');
            }}
            onOpenCreateTrip={() => setShowCreateModal(true)}
            onOpenJoinTrip={() => setShowJoinModal(true)}
          />
        </div>

        {/* Right Column: Active Trip Workspace (WhatsApp Group Workspace) */}
        <div
          className={`flex-1 min-h-0 flex flex-col bg-[#0b141a] overflow-hidden relative h-full ${
            !activeTripId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {!activeTripId ? (
            /* Desktop Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-xl">
                <MessageSquare className="w-10 h-10 text-emerald-400 animate-pulse" />
              </div>
              <div className="max-w-sm space-y-1">
                <h2 className="text-xl font-extrabold text-white">Select a Trip Group</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Choose a trip group from the left panel to chat with members, split expenses, and track your trip itinerary in real time.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
              >
                + Create New Trip
              </button>
            </div>
          ) : (
            /* Active Trip Workspace - WhatsApp Group Chat Format */
            tripData && (
              <div className="flex-1 min-h-0 flex flex-col relative h-full overflow-hidden">
                {/* Trip Group Header */}
                <TripWorkspaceHeader
                  trip={tripData}
                  members={members}
                  isAdmin={isAdmin}
                  onBackMobile={() => setActiveTripId(null)}
                  onOpenInvite={() => setShowInviteModal(true)}
                  onOpenTripInfo={() => setShowTripInfo(true)}
                />

                {/* Navigation sub-header when inside a specific detail view (Expenses, Itinerary, etc.) */}
                {activeSection !== 'feed' && (
                  <div className="bg-[#111b21] border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs text-slate-300 flex-shrink-0">
                    <button
                      onClick={() => setActiveSection('feed')}
                      className="flex items-center gap-1.5 text-emerald-400 font-bold hover:underline"
                    >
                      ← Back to Group Chat
                    </button>
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                      {activeSection}
                    </span>
                  </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
                  {activeSection === 'feed' && (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
                      <ActivityFeed
                        activities={activities}
                        expenses={expenses}
                        itinerary={itinerary}
                        bookings={bookings}
                        tasks={tasks}
                        polls={polls}
                        documents={documents}
                        members={members}
                        currentUser={user}
                        onSelectExpense={(exp) => setSelectedExpense(exp)}
                        onEditExpense={(exp) => {
                          setExpenseToEdit(exp);
                          setShowAddEditExpenseModal(true);
                        }}
                        onDeleteExpense={handleDeleteExpense}
                        onPayExpenseSplit={(exp, userShare, payerName) => {
                          setPaySplitInfo({ expense: exp, userShare, payerName });
                        }}
                        onVotePoll={() => loadWorkspaceData(activeTripId)}
                        onToggleTaskStatus={() => loadWorkspaceData(activeTripId)}
                        onNavigateSection={(sec) => setActiveSection(sec)}
                      />
                      {/* WhatsApp Chat Composer fixed at bottom of chat */}
                      <WhatsAppComposer
                        onSendMessage={handleSendMessage}
                        onSelectAction={handleSelectQuickAction}
                      />
                    </div>
                  )}

                  {activeSection === 'expenses' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <ExpensesView
                        tripId={activeTripId}
                        expenses={expenses}
                        members={members}
                        currentUser={user}
                        onRefresh={() => {
                          loadWorkspaceData(activeTripId);
                        }}
                      />
                    </div>
                  )}

                  {activeSection === 'settlements' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <SettlementSheet
                        tripId={activeTripId}
                        settlementsData={settlementsData}
                        onRefresh={() => loadWorkspaceData(activeTripId)}
                      />
                    </div>
                  )}

                  {activeSection === 'itinerary' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <ItineraryView
                        tripId={activeTripId}
                        items={itinerary}
                        members={members}
                        onRefresh={() => {
                          loadWorkspaceData(activeTripId);
                        }}
                      />
                    </div>
                  )}

                  {activeSection === 'bookings' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <BookingsView
                        tripId={activeTripId}
                        bookings={bookings}
                        onRefresh={() => {
                          loadWorkspaceData(activeTripId);
                        }}
                      />
                    </div>
                  )}

                  {activeSection === 'budget' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <BudgetView
                        tripId={activeTripId}
                        budgetData={budgetData}
                        onRefresh={() => loadWorkspaceData(activeTripId)}
                      />
                    </div>
                  )}

                  {activeSection === 'tasks' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <TasksView
                        tripId={activeTripId}
                        tasks={tasks}
                        members={members}
                        onRefresh={() => {
                          loadWorkspaceData(activeTripId);
                        }}
                      />
                    </div>
                  )}

                  {activeSection === 'polls' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <PollsView
                        tripId={activeTripId}
                        polls={polls}
                        currentUser={user}
                        onRefresh={() => {
                          loadWorkspaceData(activeTripId);
                        }}
                      />
                    </div>
                  )}

                  {activeSection === 'documents' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <DocumentsView
                        tripId={activeTripId}
                        documents={documents}
                        onRefresh={() => {
                          loadWorkspaceData(activeTripId);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Global Drawers & Modals */}
      <CreateTripModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTripCreated={handleTripCreated}
      />

      <JoinTripModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={(id) => {
          loadTrips();
          setActiveTripId(id);
          setActiveSection('feed');
        }}
      />

      {activeTripId && (
        <>
          <InviteModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            tripId={activeTripId}
            tripName={tripData?.name || 'Trip'}
            isAdmin={isAdmin}
          />

          <TripInfoDrawer
            trip={tripData}
            members={members}
            budget={budgetData}
            isAdmin={isAdmin}
            currentUser={user}
            isOpen={showTripInfo}
            onClose={() => setShowTripInfo(false)}
            onOpenInvite={() => {
              setShowTripInfo(false);
              setShowInviteModal(true);
            }}
            onNavigateCategory={(cat) => {
              setActiveSection(cat);
              setShowTripInfo(false);
            }}
            onDeleteTrip={handleDeleteTripGroup}
          />

          <ExpenseDetailSheet
            expense={selectedExpense}
            members={members}
            currentUser={user}
            onClose={() => setSelectedExpense(null)}
            onEdit={(exp) => {
              setExpenseToEdit(exp);
              setShowAddEditExpenseModal(true);
            }}
            onDelete={(id) => handleDeleteExpense(id)}
            onPaySplit={(exp, userShare, payerName) => {
              setPaySplitInfo({ expense: exp, userShare, payerName });
            }}
          />

          <AddEditExpenseModal
            isOpen={showAddEditExpenseModal}
            onClose={() => {
              setShowAddEditExpenseModal(false);
              setExpenseToEdit(null);
            }}
            tripId={activeTripId}
            members={members}
            currentUser={user}
            expenseToEdit={expenseToEdit}
            onSuccess={() => loadWorkspaceData(activeTripId)}
          />

          {paySplitInfo && (
            <PaySplitConfirmationModal
              isOpen={Boolean(paySplitInfo)}
              onClose={() => setPaySplitInfo(null)}
              tripId={activeTripId}
              expense={paySplitInfo.expense}
              userShare={paySplitInfo.userShare}
              payerName={paySplitInfo.payerName}
              onSuccess={() => loadWorkspaceData(activeTripId)}
            />
          )}
        </>
      )}

      <NotificationsModal
        notifications={notifications}
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {pendingJoinToken && (
        <JoinInviteConfirmationModal
          token={pendingJoinToken}
          currentUser={user}
          onJoined={(joinedTripId) => {
            setPendingJoinToken(null);
            window.history.replaceState({}, '', '/');
            loadTrips();
            setActiveTripId(joinedTripId);
            setActiveSection('feed');
          }}
          onCancel={() => {
            setPendingJoinToken(null);
            window.history.replaceState({}, '', '/');
          }}
        />
      )}
    </div>
  );
};

export default App;
