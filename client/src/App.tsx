import React, { useState, useEffect, useRef } from 'react';
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
import { FinishTripConfirmationModal } from './components/FinishTripConfirmationModal';
import { TripFinalReportModal } from './components/TripFinalReportModal';

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
  apiSendChatMessage, apiMarkActivitiesRead,
  setAuthToken, removeAuthToken, getAuthToken,
  apiJoinWithToken, apiDeleteExpense, apiDeleteTrip,
  apiVotePoll, apiUpdateTask, apiUploadFile, apiCreateDocument
} from './services/api';
import { joinTripRoom, leaveTripRoom, getSocket } from './services/socket';
import {
  getTripCache, isTripCacheFresh, setTripCache, updateTripCacheItem,
  invalidateTripReportCache, clearTripCache, deleteTripCache,
  removeExpenseFromTripCache, invalidateTripWorkspaceCache,
  isSectionLoadedInCache, markSectionLoadedInCache, invalidateSectionInCache
} from './services/tripCache';
import { Compass, MessageSquare, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingJoinToken, setPendingJoinToken] = useState<string | null>(null);

  // Active Trip Race-Condition & Sequencing Controls
  const activeTripIdRef = useRef<string | null>(null);
  const activeSectionRef = useRef<string>('feed');
  const sectionVersionRef = useRef<Map<string, number>>(new Map());
  const loadSeqRef = useRef<number>(0);
  const inFlightLoadsRef = useRef<Map<string, Promise<any>>>(new Map());
  const inFlightSectionRef = useRef<Map<string, Promise<any>>>(new Map());
  const lastSectionFetchTimeRef = useRef<Map<string, number>>(new Map());

  // Helpers for section mutation tracking across rapid switches & preloads
  const bumpSectionVersion = (tId: string, section: string): number => {
    const key = `${tId}:${section}`;
    const next = (sectionVersionRef.current.get(key) || 0) + 1;
    sectionVersionRef.current.set(key, next);
    return next;
  };

  const getSectionVersion = (tId: string, section: string): number => {
    return sectionVersionRef.current.get(`${tId}:${section}`) || 0;
  };

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
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

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
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Synchronize ref on activeTripId change
  useEffect(() => {
    activeTripIdRef.current = activeTripId;
  }, [activeTripId]);

  // Synchronize ref on activeSection change to prevent stale closures in socket handlers
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

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

  // History / Popstate handler for WhatsApp-style mobile back button behavior
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const path = window.location.pathname;
      if (path.startsWith('/trips/')) {
        const tId = path.split('/trips/')[1]?.split('?')[0];
        if (tId) {
          setActiveTripId(tId);
          setActiveSection('feed');
          return;
        }
      }
      setActiveTripId(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load Trips
  const loadTrips = async () => {
    if (!user) return;
    try {
      const res = await apiGetTrips();
      const loadedTrips = res.trips || [];
      setTrips(loadedTrips);
      // Check if URL has active trip e.g. /trips/:id
      const path = window.location.pathname;
      let urlTripId: string | null = null;
      if (path.startsWith('/trips/')) {
        urlTripId = path.split('/trips/')[1]?.split('?')[0] || null;
      }
      if (urlTripId && loadedTrips.some((t: any) => t._id === urlTripId)) {
        setActiveTripId(urlTripId);
      } else if (!activeTripId && loadedTrips.length > 0 && window.innerWidth >= 768) {
        setActiveTripId(loadedTrips[0]._id);
      }
    } catch (err) {
      console.error('Error loading trips:', err);
    }
  };

  useEffect(() => {
    if (user) loadTrips();
  }, [user]);

  const handleSelectTrip = (id: string | null) => {
    if (id) {
      if (activeTripId !== id && window.location.pathname !== `/trips/${id}`) {
        window.history.pushState({ tripId: id }, '', `/trips/${id}`);
      }
      activeTripIdRef.current = id;
      setActiveTripId(id);
      setActiveSection('feed');
      // Clear unread count for selected trip locally
      setTrips((prev) =>
        prev.map((t) => (t._id === id ? { ...t, unreadCount: 0 } : t))
      );
      // Call read activity status endpoint
      apiMarkActivitiesRead(id).catch((err) =>
        console.warn('Failed to mark read:', err)
      );
    } else {
      if (window.location.pathname.startsWith('/trips/')) {
        window.history.pushState({}, '', '/');
      }
      activeTripIdRef.current = null;
      setActiveTripId(null);
    }
  };

  // Helper function to safely merge existing activities with incoming activities (from API or socket)
  // Scoped strictly to targetTripId to prevent chat data leaking between trips!
  const mergeActivities = (existing: any[], incoming: any[], targetTripId?: string) => {
    const map = new Map<string, any>();

    const isMatchTrip = (act: any) => {
      if (!targetTripId) return true;
      const actTripId = String(act.tripId?._id || act.tripId || '').trim();
      return !actTripId || actTripId === String(targetTripId).trim();
    };

    const getKey = (act: any) => {
      if (act._id) return String(act._id);
      if (act.clientMessageId) return String(act.clientMessageId);
      if (act.metadata?.clientMessageId) return String(act.metadata.clientMessageId);
      return null;
    };

    existing.forEach((act) => {
      if (!isMatchTrip(act)) return;
      const key = getKey(act);
      if (key) map.set(key, act);
    });

    incoming.forEach((act) => {
      if (!isMatchTrip(act)) return;
      const key = getKey(act);
      const clientMsgId = act.clientMessageId || act.metadata?.clientMessageId;

      let existingKeyToReplace: string | null = null;
      if (clientMsgId && map.has(clientMsgId)) {
        existingKeyToReplace = clientMsgId;
      } else {
        for (const [k, v] of map.entries()) {
          if (v.isPending && v.description === act.description) {
            const vUser = String(v.userId?._id || v.userId?.id || v.userId || '');
            const actUser = String(act.userId?._id || act.userId?.id || act.userId || '');
            if (vUser && vUser === actUser) {
              existingKeyToReplace = k;
              break;
            }
          }
        }
      }

      if (existingKeyToReplace) {
        map.delete(existingKeyToReplace);
      }

      if (key) {
        map.set(key, act);
      }
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    return merged;
  };

  const safeFetch = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch {
      return fallback;
    }
  };

  // Granular section refresh with debounce and in-flight deduplication
  const refreshSection = async (tId: string, section: string, force = false): Promise<void> => {
    if (!tId) return;

    const key = `${tId}:${section}`;
    const now = Date.now();
    const lastTime = lastSectionFetchTimeRef.current.get(key) || 0;

    // Deduplicate rapid duplicate triggers (e.g. mutation callback + socket event within 400ms)
    if (!force && now - lastTime < 400) {
      return;
    }

    // Reuse in-flight promise if already fetching this section
    let inFlight = inFlightSectionRef.current.get(key);
    if (inFlight) {
      await inFlight;
      return;
    }

    const currentSeq = loadSeqRef.current;
    lastSectionFetchTimeRef.current.set(key, now);

    const fetchWorker = async () => {
      try {
        switch (section) {
          case 'itinerary': {
            const res = await apiGetItinerary(tId);
            const items = res.items || [];
            if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
              setItinerary(items);
            }
            updateTripCacheItem(tId, 'itinerary', () => items);
            markSectionLoadedInCache(tId, 'itinerary');
            break;
          }
          case 'bookings': {
            const res = await apiGetBookings(tId);
            const bookingsList = res.bookings || [];
            if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
              setBookings(bookingsList);
            }
            updateTripCacheItem(tId, 'bookings', () => bookingsList);
            markSectionLoadedInCache(tId, 'bookings');
            break;
          }
          case 'tasks': {
            const res = await apiGetTasks(tId);
            const tasksList = res.tasks || [];
            if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
              setTasks(tasksList);
            }
            updateTripCacheItem(tId, 'tasks', () => tasksList);
            markSectionLoadedInCache(tId, 'tasks');
            break;
          }
          case 'polls': {
            const res = await apiGetPolls(tId);
            const pollsList = res.polls || [];
            if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
              setPolls(pollsList);
            }
            updateTripCacheItem(tId, 'polls', () => pollsList);
            markSectionLoadedInCache(tId, 'polls');
            break;
          }
          case 'documents': {
            const res = await apiGetDocuments(tId);
            const docs = res.documents || [];
            if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
              setDocuments(docs);
            }
            updateTripCacheItem(tId, 'documents', () => docs);
            markSectionLoadedInCache(tId, 'documents');
            break;
          }
          case 'settlements': {
            const res = await apiGetSettlements(tId);
            if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
              setSettlementsData(res);
            }
            updateTripCacheItem(tId, 'settlements', () => res);
            markSectionLoadedInCache(tId, 'settlements');
            break;
          }
          case 'expenses': {
            const [expRes, budRes] = await Promise.all([
              apiGetExpenses(tId),
              safeFetch(apiGetBudget(tId), null)
            ]);
            const exps = expRes.expenses || [];
            const remainingSpent = exps.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
            if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
              setExpenses(exps);
              setTripData((tPrev: any) => (tPrev ? { ...tPrev, totalSpent: remainingSpent } : tPrev));
              if (budRes) setBudgetData(budRes);
            }
            updateTripCacheItem(tId, 'expenses', () => exps);
            if (budRes) updateTripCacheItem(tId, 'budget', () => budRes);
            break;
          }
          case 'members': {
            const res = await apiGetTripDetails(tId);
            if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
              setTripData(res.trip);
              setMembers(res.members || []);
            }
            updateTripCacheItem(tId, 'trip', () => res.trip);
            updateTripCacheItem(tId, 'members', () => res.members || []);
            break;
          }
        }
      } catch (err) {
        console.error(`[Workspace] Error refreshing section ${section} for trip ${tId}:`, err);
      } finally {
        inFlightSectionRef.current.delete(key);
      }
    };

    inFlight = fetchWorker();
    inFlightSectionRef.current.set(key, inFlight);
    await inFlight;
  };

  // Load Active Trip Workspace Payload (Prioritizing Chat Feed & Header first, loading secondary data on demand / non-blockingly)
  const loadWorkspaceData = async (tId: string, isBackground = false) => {
    if (!tId) return;
    activeTripIdRef.current = tId;
    const currentSeq = ++loadSeqRef.current;

    if (!isBackground) {
      // 1. Check in-memory trip cache
      const cached = getTripCache(tId);
      if (cached) {
        // CACHE HIT: Instantly restore isolated cached dataset to UI state
        setTripData(cached.trip);
        setMembers(cached.members || []);
        setExpenses(cached.expenses || []);
        setBudgetData(cached.budget || null);
        setItinerary(cached.itinerary || []);
        setBookings(cached.bookings || []);
        setSettlementsData(cached.settlements || null);
        setTasks(cached.tasks || []);
        setPolls(cached.polls || []);
        setDocuments(cached.documents || []);
        // Strictly filter cached activities to this trip only!
        setActivities(
          (cached.activities || []).filter(
            (a: any) => !a.tripId || String(a.tripId?._id || a.tripId) === tId
          )
        );
        setWorkspaceLoading(false);
        setWorkspaceError(null);

        // If cached data is fresh (within 5-minute TTL), skip redundant background fetch storm!
        if (isTripCacheFresh(tId)) {
          console.log(`[TripCache] Fresh cache HIT for ${tId}, skipping redundant background re-fetch`);
          return;
        }

        // Trigger background refresh to fetch fresh data without blocking the UI
        console.log(`[TripCache] Stale cache HIT for ${tId}, scheduling background revalidation`);
        loadWorkspaceData(tId, true);
        return;
      } else {
        // CACHE MISS: Immediately isolate state so previous trip data NEVER leaks into new trip!
        const initialTrip = trips.find((t) => t._id === tId) || null;
        setTripData(initialTrip);
        setMembers([]);
        setExpenses([]);
        setBudgetData(null);
        setItinerary([]);
        setBookings([]);
        setSettlementsData(null);
        setTasks([]);
        setPolls([]);
        setDocuments([]);
        setActivities([]);
        setWorkspaceLoading(true);
        setWorkspaceError(null);
      }
    } else {
      console.log(`[TripCache] Background refresh ${tId}`);
    }

    // PRIORITY 1: Core Chat & Header data (4 focused requests only!)
    const executePriorityFetch = async () => {
      const [detailsRes, actRes, expRes, budRes] = await Promise.all([
        apiGetTripDetails(tId),
        safeFetch(apiGetActivity(tId), { activities: [] }),
        safeFetch(apiGetExpenses(tId), { expenses: [] }),
        safeFetch(apiGetBudget(tId), null),
      ]);

      const fetchedActivities = (actRes.activities || []).filter(
        (a: any) => !a.tripId || String(a.tripId?._id || a.tripId) === tId
      );

      return {
        trip: detailsRes.trip,
        members: detailsRes.members || [],
        expenses: expRes.expenses || [],
        budget: budRes || null,
        activities: fetchedActivities,
      };
    };

    try {
      // In-flight request deduplication: reuse running request if active
      let fetchPromise = inFlightLoadsRef.current.get(tId);
      if (!fetchPromise) {
        fetchPromise = executePriorityFetch();
        inFlightLoadsRef.current.set(tId, fetchPromise);
      }

      const priorityPayload = await fetchPromise;

      // Update cache immediately with priority data
      setTripCache(tId, priorityPayload);

      // Race-Condition Guard: If user switched away to another trip, discard this stale response!
      if (activeTripIdRef.current !== tId || currentSeq !== loadSeqRef.current) {
        console.log(`[Workspace] Discarded stale workspace update for trip ${tId}. Active is ${activeTripIdRef.current}`);
        return;
      }

      // Apply priority chat and header data to React state
      setTripData(priorityPayload.trip);
      setMembers(priorityPayload.members);
      setExpenses(priorityPayload.expenses);
      setBudgetData(priorityPayload.budget);
      setWorkspaceLoading(false);
      setWorkspaceError(null);

      // Merge ONLY optimistic / pending messages for this trip with fresh server activities
      setActivities((prev) => {
        const pendingForThisTrip = prev.filter(
          (a) => a.isPending && (!a.tripId || String(a.tripId?._id || a.tripId) === tId)
        );
        return mergeActivities(priorityPayload.activities, pendingForThisTrip, tId);
      });

      // NON-BLOCKING SECONDARY PRELOAD: Load secondary data (without heavy settlements) in background
      const itinVer = getSectionVersion(tId, 'itinerary');
      const bookVer = getSectionVersion(tId, 'bookings');
      const taskVer = getSectionVersion(tId, 'tasks');
      const pollVer = getSectionVersion(tId, 'polls');
      const docVer = getSectionVersion(tId, 'documents');

      (async () => {
        try {
          const [itinRes, bookRes, taskRes, pollRes, docRes] = await Promise.all([
            safeFetch(apiGetItinerary(tId), { items: [] }),
            safeFetch(apiGetBookings(tId), { bookings: [] }),
            safeFetch(apiGetTasks(tId), { tasks: [] }),
            safeFetch(apiGetPolls(tId), { polls: [] }),
            safeFetch(apiGetDocuments(tId), { documents: [] }),
          ]);

          // Strict Sequencing & Trip Isolation Guard: Discard if user switched away or initiated a newer load
          if (activeTripIdRef.current !== tId || currentSeq !== loadSeqRef.current) {
            console.log(`[Workspace] Discarded stale secondary preload for ${tId}. Active is ${activeTripIdRef.current}`);
            return;
          }

          const canApplyItin = getSectionVersion(tId, 'itinerary') === itinVer;
          const canApplyBook = getSectionVersion(tId, 'bookings') === bookVer;
          const canApplyTask = getSectionVersion(tId, 'tasks') === taskVer;
          const canApplyPoll = getSectionVersion(tId, 'polls') === pollVer;
          const canApplyDoc = getSectionVersion(tId, 'documents') === docVer;

          const secondaryData: any = { loadedSections: {} };

          if (canApplyItin) {
            secondaryData.itinerary = itinRes.items || [];
            secondaryData.loadedSections.itinerary = true;
            setItinerary(secondaryData.itinerary);
          }
          if (canApplyBook) {
            secondaryData.bookings = bookRes.bookings || [];
            secondaryData.loadedSections.bookings = true;
            setBookings(secondaryData.bookings);
          }
          if (canApplyTask) {
            secondaryData.tasks = taskRes.tasks || [];
            secondaryData.loadedSections.tasks = true;
            setTasks(secondaryData.tasks);
          }
          if (canApplyPoll) {
            secondaryData.polls = pollRes.polls || [];
            secondaryData.loadedSections.polls = true;
            setPolls(secondaryData.polls);
          }
          if (canApplyDoc) {
            secondaryData.documents = docRes.documents || [];
            secondaryData.loadedSections.documents = true;
            setDocuments(secondaryData.documents);
          }

          setTripCache(tId, secondaryData);
        } catch (secErr) {
          console.warn('[Workspace] Background secondary preload notice:', secErr);
        }
      })();

    } catch (err: any) {
      if (activeTripIdRef.current === tId && currentSeq === loadSeqRef.current) {
        console.error('[Workspace] Error loading workspace data:', err);
        setWorkspaceError(err?.message || 'Failed to load trip group data. Tap to retry.');
        setWorkspaceLoading(false);
      }
    } finally {
      inFlightLoadsRef.current.delete(tId);
    }
  };

  useEffect(() => {
    if (activeTripId) {
      console.log(`[RTCHAT] ACTIVE_TRIP_ID ${activeTripId}`);
      joinTripRoom(activeTripId);
      loadWorkspaceData(activeTripId);
      setActiveSection('feed');

      const socket = getSocket();

      // Realtime Activity / Message handler
      const handleActivityCreated = (newActivity: any) => {
        const targetTripId = String(newActivity.tripId?._id || newActivity.tripId || '').trim();
        const activeIdNormalized = String(activeTripIdRef.current || activeTripId || '').trim();

        console.log(`[RTCHAT] EVENT_RECEIVED activityId=${newActivity._id} desc="${newActivity.description}"`);
        console.log(`[RTCHAT] EVENT_TRIP_ID target=${targetTripId} active=${activeIdNormalized}`);

        // Update trip list for ALL trips (active or non-active)
        setTrips((prev) =>
          prev.map((t) => {
            if (t._id === targetTripId) {
              return {
                ...t,
                unreadCount: targetTripId !== activeIdNormalized ? (t.unreadCount || 0) + 1 : 0,
                lastActivity: newActivity,
                updatedAt: newActivity.createdAt || new Date().toISOString(),
              };
            }
            return t;
          })
        );

        // Update in-memory cache for target trip
        updateTripCacheItem(targetTripId, 'activities', (prev = []) => mergeActivities(prev, [newActivity], targetTripId));

        // Update UI state strictly if currently viewing active trip
        if (targetTripId === activeIdNormalized) {
          setActivities((prev) => {
            const prevForTrip = prev.filter(
              (a) => !a.tripId || String(a.tripId?._id || a.tripId) === targetTripId
            );
            const nextState = mergeActivities(prevForTrip, [newActivity], targetTripId);
            console.log(`[RTCHAT] STATE_UPDATED totalActivities=${nextState.length} id=${newActivity._id}`);
            return nextState;
          });
        }
      };

      const handleMemberSync = () => {
        if (activeTripIdRef.current) {
          invalidateSectionInCache(activeTripIdRef.current, 'settlements');
          refreshSection(activeTripIdRef.current, 'members');
          if (activeSectionRef.current === 'settlements') {
            refreshSection(activeTripIdRef.current, 'settlements');
          }
        }
      };

      const handleItineraryCreated = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId && payload && payload._id) {
          bumpSectionVersion(activeId, 'itinerary');
          setItinerary((prev) => (prev.some((it) => String(it._id) === String(payload._id)) ? prev : [...prev, payload]));
          updateTripCacheItem(activeId, 'itinerary', (prev = []) =>
            prev.some((it: any) => String(it._id) === String(payload._id)) ? prev : [...prev, payload]
          );
        } else if (activeId) {
          refreshSection(activeId, 'itinerary');
        }
      };

      const handleItineraryUpdated = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId && payload && payload._id) {
          bumpSectionVersion(activeId, 'itinerary');
          setItinerary((prev) => prev.map((it) => (String(it._id) === String(payload._id) ? payload : it)));
          updateTripCacheItem(activeId, 'itinerary', (prev = []) =>
            prev.map((it: any) => (String(it._id) === String(payload._id)) ? payload : it)
          );
        } else if (activeId) {
          refreshSection(activeId, 'itinerary');
        }
      };

      const handleItineraryDeleted = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        const delItemId = String(payload?.itemId || payload?._id || '').trim();
        if (activeId && delItemId) {
          bumpSectionVersion(activeId, 'itinerary');
          setItinerary((prev) => prev.filter((it) => String(it._id) !== delItemId));
          updateTripCacheItem(activeId, 'itinerary', (prev = []) =>
            prev.filter((it: any) => String(it._id) !== delItemId)
          );
        } else if (activeId) {
          refreshSection(activeId, 'itinerary');
        }
      };

      const handleBookingCreated = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId && payload && payload._id) {
          bumpSectionVersion(activeId, 'bookings');
          setBookings((prev) => (prev.some((b) => String(b._id) === String(payload._id)) ? prev : [...prev, payload]));
          updateTripCacheItem(activeId, 'bookings', (prev = []) =>
            prev.some((b: any) => String(b._id) === String(payload._id)) ? prev : [...prev, payload]
          );
        } else if (activeId) {
          refreshSection(activeId, 'bookings');
        }
      };

      const handleBookingUpdated = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId && payload && payload._id) {
          bumpSectionVersion(activeId, 'bookings');
          setBookings((prev) => prev.map((b) => (String(b._id) === String(payload._id)) ? payload : b));
          updateTripCacheItem(activeId, 'bookings', (prev = []) =>
            prev.map((b: any) => (String(b._id) === String(payload._id)) ? payload : b)
          );
        } else if (activeId) {
          refreshSection(activeId, 'bookings');
        }
      };

      const handleBookingDeleted = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        const delBookingId = String(payload?.bookingId || payload?._id || '').trim();
        if (activeId && delBookingId) {
          bumpSectionVersion(activeId, 'bookings');
          setBookings((prev) => prev.filter((b) => String(b._id) !== delBookingId));
          updateTripCacheItem(activeId, 'bookings', (prev = []) =>
            prev.filter((b: any) => String(b._id) !== delBookingId)
          );
        } else if (activeId) {
          refreshSection(activeId, 'bookings');
        }
      };

      const handleTaskCreated = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId && payload && payload._id) {
          bumpSectionVersion(activeId, 'tasks');
          setTasks((prev) => (prev.some((t) => String(t._id) === String(payload._id)) ? prev : [payload, ...prev]));
          updateTripCacheItem(activeId, 'tasks', (prev = []) =>
            prev.some((t: any) => String(t._id) === String(payload._id)) ? prev : [payload, ...prev]
          );
        } else if (activeId) {
          refreshSection(activeId, 'tasks');
        }
      };

      const handleTaskUpdated = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId && payload && payload._id) {
          bumpSectionVersion(activeId, 'tasks');
          setTasks((prev) => prev.map((t) => (String(t._id) === String(payload._id)) ? payload : t));
          updateTripCacheItem(activeId, 'tasks', (prev = []) =>
            prev.map((t: any) => (String(t._id) === String(payload._id)) ? payload : t)
          );
        } else if (activeId) {
          refreshSection(activeId, 'tasks');
        }
      };

      const handleTaskDeleted = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        const delTaskId = String(payload?.taskId || payload?._id || '').trim();
        if (activeId && delTaskId) {
          bumpSectionVersion(activeId, 'tasks');
          setTasks((prev) => prev.filter((t) => String(t._id) !== delTaskId));
          updateTripCacheItem(activeId, 'tasks', (prev = []) =>
            prev.filter((t: any) => String(t._id) !== delTaskId)
          );
        } else if (activeId) {
          refreshSection(activeId, 'tasks');
        }
      };

      const handlePollCreated = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId && payload && payload._id) {
          bumpSectionVersion(activeId, 'polls');
          setPolls((prev) => (prev.some((p) => String(p._id) === String(payload._id)) ? prev : [payload, ...prev]));
          updateTripCacheItem(activeId, 'polls', (prev = []) =>
            prev.some((p: any) => String(p._id) === String(payload._id)) ? prev : [payload, ...prev]
          );
        } else if (activeId) {
          refreshSection(activeId, 'polls');
        }
      };

      const handlePollVoted = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId) {
          bumpSectionVersion(activeId, 'polls');
          refreshSection(activeId, 'polls');
        }
      };

      const handleDocumentCreated = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        if (activeId && payload && payload._id) {
          bumpSectionVersion(activeId, 'documents');
          setDocuments((prev) => (prev.some((d) => String(d._id) === String(payload._id)) ? prev : [payload, ...prev]));
          updateTripCacheItem(activeId, 'documents', (prev = []) =>
            prev.some((d: any) => String(d._id) === String(payload._id)) ? prev : [payload, ...prev]
          );
        } else if (activeId) {
          refreshSection(activeId, 'documents');
        }
      };

      const handleDocumentDeleted = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const activeId = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeId && targetTripId !== activeId) return;

        const delDocId = String(payload?.documentId || payload?._id || '').trim();
        if (activeId && delDocId) {
          bumpSectionVersion(activeId, 'documents');
          setDocuments((prev) => prev.filter((d) => String(d._id) !== delDocId));
          updateTripCacheItem(activeId, 'documents', (prev = []) =>
            prev.filter((d: any) => String(d._id) !== delDocId)
          );
        } else if (activeId) {
          refreshSection(activeId, 'documents');
        }
      };

      const handleSettlementSync = () => {
        if (activeTripIdRef.current) {
          invalidateTripReportCache(activeTripIdRef.current);
          invalidateSectionInCache(activeTripIdRef.current, 'settlements');
          if (activeSectionRef.current === 'settlements') {
            refreshSection(activeTripIdRef.current, 'settlements');
          }
        }
      };

      const handleExpenseCreated = (payload?: any) => {
        const exp = payload?.expense || payload;
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || exp?.tripId?._id || exp?.tripId || activeTripIdRef.current || '').trim();
        if (targetTripId) {
          invalidateTripReportCache(targetTripId);
          invalidateSectionInCache(targetTripId, 'settlements');
        }
        const activeIdNormalized = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeIdNormalized && targetTripId === activeIdNormalized && exp && exp._id) {
          setExpenses((prev) => {
            if (prev.some((e) => String(e._id) === String(exp._id))) return prev;
            const nextExpenses = [exp, ...prev];
            const newTotalSpent = nextExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            setTripData((tPrev: any) => (tPrev ? { ...tPrev, totalSpent: newTotalSpent } : tPrev));
            setBudgetData((bPrev: any) =>
              bPrev ? { ...bPrev, totalSpent: newTotalSpent, spent: newTotalSpent } : bPrev
            );
            return nextExpenses;
          });
          updateTripCacheItem(activeIdNormalized, 'expenses', (prev = []) => {
            if (prev.some((e: any) => String(e._id) === String(exp._id))) return prev;
            return [exp, ...prev];
          });
          const cached = getTripCache(activeIdNormalized);
          if (cached) cached.settlements = null;
          invalidateSectionInCache(activeIdNormalized, 'settlements');
          if (activeSectionRef.current === 'settlements') {
            refreshSection(activeIdNormalized, 'settlements');
          }
        } else if (activeIdNormalized) {
          refreshSection(activeIdNormalized, 'expenses');
          if (activeSectionRef.current === 'settlements') {
            refreshSection(activeIdNormalized, 'settlements');
          }
        }
      };

      const handleExpenseUpdated = (updatedExpense: any) => {
        if (!updatedExpense || !updatedExpense._id) {
          handleExpenseCreated();
          return;
        }
        const expIdStr = String(updatedExpense._id);
        const expTripId = String(updatedExpense.tripId?._id || updatedExpense.tripId || '').trim();
        const activeIdNormalized = String(activeTripIdRef.current || activeTripId || '').trim();

        if (expTripId) {
          invalidateTripReportCache(expTripId);
          invalidateSectionInCache(expTripId, 'settlements');
        } else if (activeIdNormalized) {
          invalidateTripReportCache(activeIdNormalized);
          invalidateSectionInCache(activeIdNormalized, 'settlements');
        }

        if (expTripId && activeIdNormalized && expTripId !== activeIdNormalized) {
          // Event belongs to a different trip, do not modify current active trip state
          return;
        }

        // 1. Immediately update expenses state in place by matching expense ID and recalculate totalSpent
        setExpenses((prev) => {
          const next = prev.map((exp) => (String(exp._id) === expIdStr ? updatedExpense : exp));
          const newTotalSpent = next.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
          setTripData((tPrev: any) => (tPrev ? { ...tPrev, totalSpent: newTotalSpent } : tPrev));
          setBudgetData((bPrev: any) =>
            bPrev ? { ...bPrev, totalSpent: newTotalSpent, spent: newTotalSpent } : bPrev
          );
          return next;
        });

        // 2. Immediately update in-memory trip cache
        if (activeIdNormalized) {
          updateTripCacheItem(activeIdNormalized, 'expenses', (prev = []) =>
            prev.map((exp: any) => (String(exp._id) === expIdStr ? updatedExpense : exp))
          );
          const cached = getTripCache(activeIdNormalized);
          if (cached) {
            const cachedExpenses = cached.expenses || [];
            const newTotal = cachedExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
            if (cached.trip) cached.trip = { ...cached.trip, totalSpent: newTotal };
            if (cached.budget) cached.budget = { ...cached.budget, totalSpent: newTotal, spent: newTotal };
            cached.settlements = null;
          }
          invalidateSectionInCache(activeIdNormalized, 'settlements');
        }

        // 3. Immediately update any activity referencing this expense in activities state
        setActivities((prev) =>
          prev.map((act) => {
            const actExpId = act.metadata?.expenseId || act.metadata?.expense?._id;
            if (actExpId && String(actExpId) === expIdStr) {
              return {
                ...act,
                metadata: {
                  ...act.metadata,
                  expense: updatedExpense,
                },
              };
            }
            return act;
          })
        );

        // 4. Update activities in trip cache
        if (activeIdNormalized) {
          updateTripCacheItem(activeIdNormalized, 'activities', (prev = []) =>
            prev.map((act: any) => {
              const actExpId = act.metadata?.expenseId || act.metadata?.expense?._id;
              if (actExpId && String(actExpId) === expIdStr) {
                return {
                  ...act,
                  metadata: {
                    ...act.metadata,
                    expense: updatedExpense,
                  },
                };
              }
              return act;
            })
          );
        }

        // 5. If user is in settlements tab, sync settlements
        if (activeSectionRef.current === 'settlements' && activeIdNormalized) {
          refreshSection(activeIdNormalized, 'settlements');
        }
      };

      const handleExpenseDeleted = (payload: any) => {
        const targetTripId = String(payload?.tripId?._id || payload?.tripId || '').trim();
        const deletedExpId = String(payload?.expenseId || payload?._id || '').trim();

        if (!deletedExpId) {
          handleExpenseCreated(payload);
          return;
        }

        // 1. Immediately purge from cache for target trip and invalidate report
        if (targetTripId) {
          removeExpenseFromTripCache(targetTripId, deletedExpId);
          invalidateSectionInCache(targetTripId, 'settlements');
        } else if (activeTripIdRef.current) {
          removeExpenseFromTripCache(activeTripIdRef.current, deletedExpId);
          invalidateSectionInCache(activeTripIdRef.current, 'settlements');
        }

        const activeIdNormalized = String(activeTripIdRef.current || '').trim();
        if (targetTripId && activeIdNormalized && targetTripId !== activeIdNormalized) {
          // Event belongs to a different trip, do not modify current active trip state
          return;
        }

        // 2. Immediately update UI state for active trip
        setExpenses((prev) => {
          const filtered = prev.filter((e) => String(e._id) !== deletedExpId);
          const remainingSpent = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
          setTripData((tPrev: any) => (tPrev ? { ...tPrev, totalSpent: remainingSpent } : tPrev));
          setBudgetData((bPrev: any) =>
            bPrev ? { ...bPrev, totalSpent: remainingSpent, spent: remainingSpent } : bPrev
          );
          return filtered;
        });

        // 3. Immediately remove any activities tied to deleted expense from feed
        setActivities((prev) =>
          prev.filter((act) => {
            const actExpId = act.metadata?.expenseId || act.metadata?.expense?._id;
            return String(actExpId) !== deletedExpId;
          })
        );

        // 4. Clear selected expense if it was the deleted one
        setSelectedExpense((prev: any) =>
          prev && String(prev._id) === deletedExpId ? null : prev
        );

        // 5. If user is in settlements tab, sync settlements
        if (activeSectionRef.current === 'settlements' && activeIdNormalized) {
          refreshSection(activeIdNormalized, 'settlements');
        }
      };

      const handleTripUpdated = (updatedTrip: any) => {
        if (updatedTrip && String(updatedTrip._id) === activeTripIdRef.current) {
          setTripData((prev: any) => ({ ...prev, ...updatedTrip }));
          setTrips((prev: any[]) =>
            prev.map((t) => (String(t._id) === String(updatedTrip._id) ? { ...t, ...updatedTrip } : t))
          );
        }
      };

      const handleTripLifecycle = (payload: any) => {
        if (payload && String(payload.tripId) === activeTripIdRef.current) {
          if (payload.trip) {
            setTripData((prev: any) => ({ ...prev, ...payload.trip }));
            setTrips((prev: any[]) =>
              prev.map((t) => (String(t._id) === String(payload.tripId) ? { ...t, ...payload.trip } : t))
            );
          }
          invalidateSectionInCache(activeTripIdRef.current, 'settlements');
          if (activeSectionRef.current === 'settlements' && activeTripIdRef.current) {
            refreshSection(activeTripIdRef.current, 'settlements');
          }
        }
      };

      socket.on('activity.created', handleActivityCreated);
      socket.on('expense.created', handleExpenseCreated);
      socket.on('expense.updated', handleExpenseUpdated);
      socket.on('expense.deleted', handleExpenseDeleted);
      socket.on('member.joined', handleMemberSync);
      socket.on('member.removed', handleMemberSync);
      socket.on('itinerary.created', handleItineraryCreated);
      socket.on('itinerary.updated', handleItineraryUpdated);
      socket.on('itinerary.deleted', handleItineraryDeleted);
      socket.on('booking.created', handleBookingCreated);
      socket.on('booking.updated', handleBookingUpdated);
      socket.on('booking.deleted', handleBookingDeleted);
      socket.on('task.created', handleTaskCreated);
      socket.on('task.updated', handleTaskUpdated);
      socket.on('task.deleted', handleTaskDeleted);
      socket.on('poll.created', handlePollCreated);
      socket.on('poll.voted', handlePollVoted);
      socket.on('document.created', handleDocumentCreated);
      socket.on('document.deleted', handleDocumentDeleted);
      socket.on('settlement.updated', handleSettlementSync);
      socket.on('trip.updated', handleTripUpdated);
      socket.on('trip.lifecycle', handleTripLifecycle);

      return () => {
        leaveTripRoom(activeTripId);
        socket.off('activity.created', handleActivityCreated);
        socket.off('expense.created', handleExpenseCreated);
        socket.off('expense.updated', handleExpenseUpdated);
        socket.off('expense.deleted', handleExpenseDeleted);
        socket.off('member.joined', handleMemberSync);
        socket.off('member.removed', handleMemberSync);
        socket.off('itinerary.created', handleItineraryCreated);
        socket.off('itinerary.updated', handleItineraryUpdated);
        socket.off('itinerary.deleted', handleItineraryDeleted);
        socket.off('booking.created', handleBookingCreated);
        socket.off('booking.updated', handleBookingUpdated);
        socket.off('booking.deleted', handleBookingDeleted);
        socket.off('task.created', handleTaskCreated);
        socket.off('task.updated', handleTaskUpdated);
        socket.off('task.deleted', handleTaskDeleted);
        socket.off('poll.created', handlePollCreated);
        socket.off('poll.voted', handlePollVoted);
        socket.off('document.created', handleDocumentCreated);
        socket.off('document.deleted', handleDocumentDeleted);
        socket.off('settlement.updated', handleSettlementSync);
        socket.off('trip.updated', handleTripUpdated);
        socket.off('trip.lifecycle', handleTripLifecycle);
      };
    }
  }, [activeTripId]);

  // On-demand secondary section loader: fetches data when user opens a secondary section tab if not yet loaded
  useEffect(() => {
    if (!activeTripId) return;
    const secondarySections = ['itinerary', 'bookings', 'settlements', 'tasks', 'polls', 'documents'];
    if (secondarySections.includes(activeSection)) {
      if (!isSectionLoadedInCache(activeTripId, activeSection)) {
        refreshSection(activeTripId, activeSection);
      }
    }
  }, [activeTripId, activeSection]);

  const handleLogout = () => {
    removeAuthToken();
    clearTripCache();
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

    console.log(`[RTCHAT] send_started tripId=${activeTripId} text="${text.trim()}" clientMessageId=${clientMessageId}`);

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

    console.log(`[RTCHAT] optimistic_message_added clientMessageId=${clientMessageId}`);
    setActivities((prev) => [...prev, optimisticActivity]);

    // 2. Persistent API call in background
    try {
      const res = await apiSendChatMessage(activeTripId, text.trim(), clientMessageId);
      const elapsed = Date.now() - startTime;
      console.log(`[RTCHAT] api_response_received clientMessageId=${clientMessageId} elapsed=${elapsed}ms`);
      console.log(`[RTCHAT] api_activity_id activityId=${res.activity?._id}`);

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

  const handleVotePoll = async (pollId: string, optionId: string) => {
    if (!activeTripId) return;
    try {
      bumpSectionVersion(activeTripId, 'polls');
      await apiVotePoll(activeTripId, pollId, optionId);
      await refreshSection(activeTripId, 'polls');
    } catch (err: any) {
      console.error('Failed to vote on poll:', err);
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!activeTripId) return;
    try {
      const nextStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
      bumpSectionVersion(activeTripId, 'tasks');
      // Optimistic update
      setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: nextStatus } : t)));
      updateTripCacheItem(activeTripId, 'tasks', (prev = []) =>
        prev.map((t: any) => (t._id === taskId ? { ...t, status: nextStatus } : t))
      );
      await apiUpdateTask(activeTripId, taskId, { status: nextStatus });
    } catch (err: any) {
      console.error('Failed to update task status:', err);
      refreshSection(activeTripId, 'tasks', true);
    }
  };

  const handleUploadPhoto = async (file: File) => {
    if (!activeTripId) return;
    try {
      bumpSectionVersion(activeTripId, 'documents');
      const uploaded = await apiUploadFile(file, 'chat');
      if (uploaded?.secureUrl || uploaded?.url) {
        const docRes = await apiCreateDocument(activeTripId, {
          name: uploaded.originalName || file.name,
          type: 'PHOTO',
          fileUrl: uploaded.secureUrl || uploaded.url,
          fileSize: uploaded.bytes ? `${Math.round(uploaded.bytes / 1024)} KB` : `${Math.round(file.size / 1024)} KB`
        });
        if (docRes?.document) {
          setDocuments((prev) => [docRes.document, ...prev]);
          updateTripCacheItem(activeTripId, 'documents', (prev = []) => [docRes.document, ...prev]);
        } else {
          refreshSection(activeTripId, 'documents');
        }
      }
    } catch (err) {
      console.error('Failed to upload photo:', err);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!activeTripId || !id) return;
    const expIdStr = String(id);
    const previousExpenses = [...expenses];
    const previousActivities = [...activities];
    const previousTripData = tripData;
    const previousBudgetData = budgetData;

    try {
      // 1. Immediately purge from in-memory cache and invalidate report cache & settlements
      removeExpenseFromTripCache(activeTripId, expIdStr);
      invalidateSectionInCache(activeTripId, 'settlements');

      // 2. Optimistic UI update: Remove from expenses list immediately
      const remainingExpenses = expenses.filter((e) => String(e._id) !== expIdStr);
      setExpenses(remainingExpenses);

      // 3. Optimistic UI update: Remove related activities from chat feed immediately
      setActivities((prev) =>
        prev.filter((act) => {
          const actExpId = act.metadata?.expenseId || act.metadata?.expense?._id;
          return String(actExpId) !== expIdStr;
        })
      );

      // 4. Close detail sheet if currently viewing this expense
      setSelectedExpense((prev: any) => (prev && String(prev._id) === expIdStr ? null : prev));

      // 5. Optimistically update trip and budget totals immediately
      const remainingSpent = remainingExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      setTripData((prev: any) => (prev ? { ...prev, totalSpent: remainingSpent } : prev));
      setBudgetData((prev: any) =>
        prev ? { ...prev, totalSpent: remainingSpent, spent: remainingSpent } : prev
      );

      // 6. Delete on backend
      await apiDeleteExpense(activeTripId, expIdStr);

      // 7. Refresh expenses and settlements if active
      refreshSection(activeTripId, 'expenses');
      if (activeSectionRef.current === 'settlements') {
        refreshSection(activeTripId, 'settlements');
      }
    } catch (err: any) {
      console.error('[Expense] Error deleting expense:', err);
      // Rollback optimistic state if backend deletion failed
      setExpenses(previousExpenses);
      setActivities(previousActivities);
      setTripData(previousTripData);
      setBudgetData(previousBudgetData);
      alert(err.message || 'Failed to delete expense. Please try again.');
      refreshSection(activeTripId, 'expenses', true);
    }
  };

  const handleDeleteTripGroup = async () => {
    if (!activeTripId) return;
    try {
      const deletedId = activeTripId;
      await apiDeleteTrip(deletedId);
      deleteTripCache(deletedId);
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
            onSelectTrip={(id) => handleSelectTrip(id)}
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
          ) : workspaceLoading && !tripData ? (
            /* WhatsApp Loading Skeleton */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-400">Loading trip group...</p>
            </div>
          ) : workspaceError && !tripData ? (
            /* Error State with Retry */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-base font-bold text-slate-100">Unable to load trip group</h3>
                <p className="text-xs text-rose-400 leading-relaxed">{workspaceError}</p>
              </div>
              <button
                onClick={() => activeTripId && loadWorkspaceData(activeTripId)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
              >
                Retry
              </button>
            </div>
          ) : (
            /* Active Trip Workspace - WhatsApp Group Chat Format */
            tripData && (
              <div className="flex-1 min-h-0 flex flex-col relative h-full overflow-hidden">
                {/* Trip Group Header */}
                <TripWorkspaceHeader
                  key={`header-${activeTripId}`}
                  trip={tripData}
                  members={members}
                  isAdmin={isAdmin}
                  onBackMobile={() => {
                    if (window.history.length > 1 && window.location.pathname.startsWith('/trips/')) {
                      window.history.back();
                    } else {
                      handleSelectTrip(null);
                    }
                  }}
                  onOpenInvite={() => setShowInviteModal(true)}
                  onOpenTripInfo={() => setShowTripInfo(true)}
                  onOpenTripReport={() => setShowReportModal(true)}
                />

                {/* Pinned Trip Summary with quick access to Trip Summary Report */}
                <PinnedTripSummary
                  trip={tripData}
                  budget={budgetData}
                  members={members}
                  nextItineraryItem={itinerary?.[0]}
                  pendingTasksCount={tasks.filter((t: any) => t.status !== 'DONE').length}
                  onOpenTripInfo={() => setShowTripInfo(true)}
                  onNavigateSection={(sec) => setActiveSection(sec)}
                  onOpenTripReport={() => setShowReportModal(true)}
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
                        key={`feed-${activeTripId}`}
                        isLoading={workspaceLoading}
                        tripId={activeTripId}
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
                        onVotePoll={handleVotePoll}
                        onToggleTaskStatus={handleToggleTaskStatus}
                        onNavigateSection={(sec) => setActiveSection(sec)}
                      />
                      {/* WhatsApp Chat Composer fixed at bottom of chat */}
                      <WhatsAppComposer
                        key={`composer-${activeTripId}`}
                        onSendMessage={handleSendMessage}
                        onSelectAction={handleSelectQuickAction}
                        onUploadPhoto={handleUploadPhoto}
                        isClosed={tripData?.status === 'CLOSED'}
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
                          refreshSection(activeTripId, 'expenses', true);
                        }}
                        onDeleteExpense={handleDeleteExpense}
                      />
                    </div>
                  )}

                  {activeSection === 'settlements' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <SettlementSheet
                        tripId={activeTripId}
                        settlementsData={settlementsData}
                        onRefresh={() => refreshSection(activeTripId, 'settlements', true)}
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
                          refreshSection(activeTripId, 'itinerary', true);
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
                          refreshSection(activeTripId, 'bookings', true);
                        }}
                      />
                    </div>
                  )}

                  {activeSection === 'budget' && (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <BudgetView
                        tripId={activeTripId}
                        budgetData={budgetData}
                        onRefresh={() => refreshSection(activeTripId, 'expenses', true)}
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
                          refreshSection(activeTripId, 'tasks', true);
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
                          refreshSection(activeTripId, 'polls', true);
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
                          refreshSection(activeTripId, 'documents', true);
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
            onOpenTripReport={() => setShowReportModal(true)}
            onOpenFinishConfirmation={() => setShowFinishModal(true)}
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
            onSuccess={() => {
              if (activeTripId) {
                invalidateTripReportCache(activeTripId);
                invalidateSectionInCache(activeTripId, 'settlements');
                refreshSection(activeTripId, 'expenses');
                if (activeSectionRef.current === 'settlements') {
                  refreshSection(activeTripId, 'settlements');
                }
              }
            }}
          />

          {paySplitInfo && (
            <PaySplitConfirmationModal
              isOpen={Boolean(paySplitInfo)}
              onClose={() => setPaySplitInfo(null)}
              tripId={activeTripId}
              expense={paySplitInfo.expense}
              userShare={paySplitInfo.userShare}
              payerName={paySplitInfo.payerName}
              onSuccess={(updatedExpense?: any) => {
                if (activeTripId) {
                  invalidateTripReportCache(activeTripId);
                  invalidateSectionInCache(activeTripId, 'settlements');
                }
                if (updatedExpense) {
                  // In-place update of existing card immediately
                  setExpenses((prev) =>
                    prev.map((e) => (String(e._id) === String(updatedExpense._id) ? updatedExpense : e))
                  );
                  setActivities((prev) =>
                    prev.map((act) => {
                      const actExpId = act.metadata?.expenseId || act.metadata?.expense?._id;
                      if (actExpId && String(actExpId) === String(updatedExpense._id)) {
                        return {
                          ...act,
                          metadata: {
                            ...act.metadata,
                            expense: updatedExpense,
                          },
                        };
                      }
                      return act;
                    })
                  );
                }
                if (activeSectionRef.current === 'settlements') {
                  refreshSection(activeTripId, 'settlements');
                }
              }}
            />
          )}

          {/* Finish Trip Confirmation Modal */}
          <FinishTripConfirmationModal
            isOpen={showFinishModal}
            onClose={() => setShowFinishModal(false)}
            tripId={activeTripId}
            onTripFinished={(updatedTrip) => {
              setTripData((prev: any) => ({ ...prev, ...updatedTrip }));
              loadWorkspaceData(activeTripId, true);
              loadTrips();
            }}
          />

          {/* Trip Summary and Final Report Modal */}
          <TripFinalReportModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            tripId={activeTripId}
            isAdmin={isAdmin}
            onOpenFinishConfirmation={() => setShowFinishModal(true)}
            onTripClosed={(updatedTrip) => {
              setTripData((prev: any) => ({ ...prev, ...updatedTrip }));
              loadWorkspaceData(activeTripId, true);
              loadTrips();
            }}
          />
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
