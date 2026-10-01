const API_BASE = '/api';

export const getAuthToken = () => localStorage.getItem('tripmate_token');
export const setAuthToken = (token: string) => localStorage.setItem('tripmate_token', token);
export const removeAuthToken = () => localStorage.removeItem('tripmate_token');

const request = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  } catch (err) {
    // Fallback directly to backend port 5000 if relative proxy fetch fails
    res = await fetch(`http://localhost:5000${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'An error occurred during request');
  }

  return data;
};

// Auth
export const apiLogin = (email: string, password: string) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const apiRegister = (name: string, email: string, password: string, avatar?: string) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, avatar }) });

export const apiGetMe = () => request('/auth/me');

// Trips
export const apiGetTrips = () => request('/trips');
export const apiCreateTrip = (tripData: any) =>
  request('/trips', { method: 'POST', body: JSON.stringify(tripData) });
export const apiGetTripDetails = (tripId: string) => request(`/trips/${tripId}`);
export const apiUpdateTrip = (tripId: string, updates: any) =>
  request(`/trips/${tripId}`, { method: 'PATCH', body: JSON.stringify(updates) });
export const apiDeleteTrip = (tripId: string) =>
  request(`/trips/${tripId}`, { method: 'DELETE' });

// Invites
export const apiCreateInvite = (tripId: string, options?: any) =>
  request(`/trips/${tripId}/invites`, { method: 'POST', body: JSON.stringify(options || {}) });
export const apiGetInvites = (tripId: string) => request(`/trips/${tripId}/invites`);
export const apiRevokeInvite = (tripId: string, inviteId: string) =>
  request(`/trips/${tripId}/invites/${inviteId}/revoke`, { method: 'POST' });
export const apiPreviewInvite = (token: string) => request(`/invites/${token}`);
export const apiJoinWithToken = (token: string) =>
  request(`/invites/${token}/join`, { method: 'POST' });
export const apiJoinWithCode = (code: string) =>
  request('/trips/join-with-code', { method: 'POST', body: JSON.stringify({ code }) });

// Members
export const apiGetMembers = (tripId: string) => request(`/trips/${tripId}/members`);
export const apiRemoveMember = (tripId: string, memberId: string) =>
  request(`/trips/${tripId}/members/${memberId}`, { method: 'DELETE' });
export const apiUpdateMemberRole = (tripId: string, memberId: string, role: string) =>
  request(`/trips/${tripId}/members/${memberId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });

// Expenses
export const apiGetExpenses = (tripId: string) => request(`/trips/${tripId}/expenses`);
export const apiCreateExpense = (tripId: string, expenseData: any) =>
  request(`/trips/${tripId}/expenses`, { method: 'POST', body: JSON.stringify(expenseData) });
export const apiUpdateExpense = (tripId: string, expenseId: string, updates: any) =>
  request(`/trips/${tripId}/expenses/${expenseId}`, { method: 'PATCH', body: JSON.stringify(updates) });
export const apiDeleteExpense = (tripId: string, expenseId: string) =>
  request(`/trips/${tripId}/expenses/${expenseId}`, { method: 'DELETE' });
export const apiPayExpenseSplit = (tripId: string, expenseId: string, userId?: string) =>
  request(`/trips/${tripId}/expenses/${expenseId}/pay-split`, { method: 'POST', body: JSON.stringify({ userId }) });

// Budget
export const apiGetBudget = (tripId: string) => request(`/trips/${tripId}/budget`);
export const apiUpdateBudget = (tripId: string, budgetData: any) =>
  request(`/trips/${tripId}/budget`, { method: 'PATCH', body: JSON.stringify(budgetData) });

// Settlements
export const apiGetSettlements = (tripId: string) => request(`/trips/${tripId}/settlements`);
export const apiRecordSettlement = (tripId: string, recordData: any) =>
  request(`/trips/${tripId}/settlements/record`, { method: 'POST', body: JSON.stringify(recordData) });
export const apiPaySettlement = (tripId: string, settlementId: string) =>
  request(`/trips/${tripId}/settlements/${settlementId}/pay`, { method: 'POST' });

// Itinerary
export const apiGetItinerary = (tripId: string) => request(`/trips/${tripId}/itinerary`);
export const apiCreateItineraryItem = (tripId: string, itemData: any) =>
  request(`/trips/${tripId}/itinerary`, { method: 'POST', body: JSON.stringify(itemData) });
export const apiUpdateItineraryItem = (tripId: string, itemId: string, updates: any) =>
  request(`/trips/${tripId}/itinerary/${itemId}`, { method: 'PATCH', body: JSON.stringify(updates) });
export const apiDeleteItineraryItem = (tripId: string, itemId: string) =>
  request(`/trips/${tripId}/itinerary/${itemId}`, { method: 'DELETE' });

// Bookings
export const apiGetBookings = (tripId: string) => request(`/trips/${tripId}/bookings`);
export const apiCreateBooking = (tripId: string, bookingData: any) =>
  request(`/trips/${tripId}/bookings`, { method: 'POST', body: JSON.stringify(bookingData) });
export const apiUpdateBooking = (tripId: string, bookingId: string, updates: any) =>
  request(`/trips/${tripId}/bookings/${bookingId}`, { method: 'PATCH', body: JSON.stringify(updates) });
export const apiDeleteBooking = (tripId: string, bookingId: string) =>
  request(`/trips/${tripId}/bookings/${bookingId}`, { method: 'DELETE' });

// Documents
export const apiGetDocuments = (tripId: string) => request(`/trips/${tripId}/documents`);
export const apiCreateDocument = (tripId: string, docData: any) =>
  request(`/trips/${tripId}/documents`, { method: 'POST', body: JSON.stringify(docData) });
export const apiDeleteDocument = (tripId: string, docId: string) =>
  request(`/trips/${tripId}/documents/${docId}`, { method: 'DELETE' });

// Tasks
export const apiGetTasks = (tripId: string) => request(`/trips/${tripId}/tasks`);
export const apiCreateTask = (tripId: string, taskData: any) =>
  request(`/trips/${tripId}/tasks`, { method: 'POST', body: JSON.stringify(taskData) });
export const apiUpdateTask = (tripId: string, taskId: string, updates: any) =>
  request(`/trips/${tripId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(updates) });
export const apiDeleteTask = (tripId: string, taskId: string) =>
  request(`/trips/${tripId}/tasks/${taskId}`, { method: 'DELETE' });

// Polls
export const apiGetPolls = (tripId: string) => request(`/trips/${tripId}/polls`);
export const apiCreatePoll = (tripId: string, pollData: any) =>
  request(`/trips/${tripId}/polls`, { method: 'POST', body: JSON.stringify(pollData) });
export const apiVotePoll = (tripId: string, pollId: string, optionId: string) =>
  request(`/trips/${tripId}/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) });

// Activity & Chat
export const apiGetActivity = (tripId: string) => request(`/trips/${tripId}/activity`);
export const apiSendChatMessage = (tripId: string, message: string) =>
  request(`/trips/${tripId}/activity`, { method: 'POST', body: JSON.stringify({ message }) });

// Notifications
export const apiGetNotifications = () => request('/notifications');
export const apiMarkNotificationRead = (id: string) =>
  request(`/notifications/${id}/read`, { method: 'PATCH' });
export const apiMarkAllNotificationsRead = () =>
  request('/notifications/read-all', { method: 'PATCH' });
