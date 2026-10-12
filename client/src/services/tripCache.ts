export interface TripWorkspaceData {
  trip: any;
  members: any[];
  expenses: any[];
  budget: any;
  itinerary: any[];
  bookings: any[];
  settlements: any;
  tasks: any[];
  polls: any[];
  documents: any[];
  activities: any[];
  cachedAt: number;
}

export interface CachedReportEntry {
  report: any;
  cachedAt: number;
}

// In-memory cache map supporting structured composite keys: "tripId:dataType"
const cacheMap = new Map<string, any>();

// TTL Policies
const WORKSPACE_CACHE_TTL_MS = 60 * 1000; // 60 seconds freshness for workspace
const REPORT_CACHE_TTL_MS = 60 * 1000;    // 60 seconds freshness for authoritative reports

const getWorkspaceKey = (tripId: string) => `trip:${tripId}:workspace`;
const getReportKey = (tripId: string) => `trip:${tripId}:report`;

/**
 * Retrieve cached workspace data for a given tripId
 */
export const getTripCache = (tripId: string): TripWorkspaceData | undefined => {
  if (!tripId) return undefined;
  const key = getWorkspaceKey(tripId);
  const cached = cacheMap.get(key) as TripWorkspaceData | undefined;
  if (cached) {
    console.log(`[TripCache] HIT workspace for ${tripId}`);
  } else {
    console.log(`[TripCache] MISS workspace for ${tripId}`);
  }
  return cached;
};

/**
 * Check if the workspace cache for a trip is fresh (within TTL)
 */
export const isTripCacheFresh = (tripId: string): boolean => {
  if (!tripId) return false;
  const cached = cacheMap.get(getWorkspaceKey(tripId)) as TripWorkspaceData | undefined;
  if (!cached || !cached.cachedAt) return false;
  return Date.now() - cached.cachedAt < WORKSPACE_CACHE_TTL_MS;
};

/**
 * Store complete workspace data for a tripId
 */
export const setTripCache = (
  tripId: string,
  data: Omit<TripWorkspaceData, 'cachedAt'>
): TripWorkspaceData => {
  const entry: TripWorkspaceData = {
    ...data,
    cachedAt: Date.now()
  };
  cacheMap.set(getWorkspaceKey(tripId), entry);
  console.log(`[TripCache] Stored fresh workspace data for ${tripId}`);
  return entry;
};

/**
 * Partially update a single dataset array or object in the trip workspace cache
 */
export const updateTripCacheItem = <K extends keyof Omit<TripWorkspaceData, 'cachedAt'>>(
  tripId: string,
  key: K,
  updater: (prev: TripWorkspaceData[K]) => TripWorkspaceData[K]
) => {
  const cacheKey = getWorkspaceKey(tripId);
  const cached = cacheMap.get(cacheKey) as TripWorkspaceData | undefined;
  if (cached) {
    cached[key] = updater(cached[key]);
    cached.cachedAt = Date.now();
    console.log(`[TripCache] Realtime update applied to key "${String(key)}" for ${tripId}`);
  }
};

/**
 * Retrieve cached settlement report data for a trip
 */
export const getTripReportCache = (
  tripId: string
): { report: any; isFresh: boolean } | undefined => {
  if (!tripId) return undefined;
  const key = getReportKey(tripId);
  const cached = cacheMap.get(key) as CachedReportEntry | undefined;
  if (!cached || !cached.report) {
    console.log(`[TripCache] MISS report for ${tripId}`);
    return undefined;
  }
  const isFresh = Date.now() - cached.cachedAt < REPORT_CACHE_TTL_MS;
  console.log(`[TripCache] HIT report for ${tripId} (isFresh=${isFresh})`);
  return { report: cached.report, isFresh };
};

/**
 * Store authoritative settlement report data for a trip
 */
export const setTripReportCache = (tripId: string, report: any): void => {
  if (!tripId || !report) return;
  const entry: CachedReportEntry = {
    report,
    cachedAt: Date.now()
  };
  cacheMap.set(getReportKey(tripId), entry);
  console.log(`[TripCache] Stored fresh report cache for ${tripId}`);
};

/**
 * Invalidate the settlement report cache for a trip
 * (called on expense or settlement mutations or socket events)
 */
export const invalidateTripReportCache = (tripId: string): void => {
  if (!tripId) return;
  const key = getReportKey(tripId);
  if (cacheMap.has(key)) {
    cacheMap.delete(key);
    console.log(`[TripCache] Invalidated report cache for ${tripId}`);
  }
};

/**
 * Remove all cached data for a deleted trip
 */
export const deleteTripCache = (tripId: string) => {
  if (!tripId) return;
  cacheMap.delete(getWorkspaceKey(tripId));
  cacheMap.delete(getReportKey(tripId));
  console.log(`[TripCache] Deleted all cache entries for ${tripId}`);
};

/**
 * Clear the entire in-memory trip cache (on user logout or account switch)
 */
export const clearTripCache = () => {
  cacheMap.clear();
  console.log(`[TripCache] Cleared all trip workspace and report cache entries on logout`);
};
