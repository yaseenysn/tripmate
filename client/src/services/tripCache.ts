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

const cacheMap = new Map<string, TripWorkspaceData>();

/**
 * Retrieve cached workspace data for a given tripId
 */
export const getTripCache = (tripId: string): TripWorkspaceData | undefined => {
  if (!tripId) return undefined;
  const cached = cacheMap.get(tripId);
  if (cached) {
    console.log(`[TripCache] HIT ${tripId}`);
  } else {
    console.log(`[TripCache] MISS ${tripId}`);
  }
  return cached;
};

/**
 * Store complete workspace data for a tripId
 */
export const setTripCache = (tripId: string, data: Omit<TripWorkspaceData, 'cachedAt'>): TripWorkspaceData => {
  const entry: TripWorkspaceData = {
    ...data,
    cachedAt: Date.now()
  };
  cacheMap.set(tripId, entry);
  console.log(`[TripCache] Updated ${tripId}`);
  return entry;
};

/**
 * Partially update a single dataset array or object in the trip cache
 */
export const updateTripCacheItem = <K extends keyof Omit<TripWorkspaceData, 'cachedAt'>>(
  tripId: string,
  key: K,
  updater: (prev: TripWorkspaceData[K]) => TripWorkspaceData[K]
) => {
  const cached = cacheMap.get(tripId);
  if (cached) {
    cached[key] = updater(cached[key]);
    cached.cachedAt = Date.now();
    console.log(`[TripCache] Realtime update applied to key "${String(key)}" for ${tripId}`);
  }
};

/**
 * Clear the entire in-memory trip cache (on user logout)
 */
export const clearTripCache = () => {
  cacheMap.clear();
  console.log(`[TripCache] Cleared all trip workspace cache entries on logout`);
};
