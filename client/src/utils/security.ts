/**
 * TripMate Frontend Security & URL Sanitization Utilities
 */

/**
 * Checks if a URL is safe to open or use in an <a href> link.
 * Permits only http: and https: protocols, and clean relative paths.
 * Explicitly rejects javascript:, data:, file:, and other unsafe schemes.
 */
export const isSafeUrl = (url: unknown): boolean => {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Relative paths within the same app
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Sanitizes a URL for use in href attributes. If the URL is unsafe (e.g. javascript:),
 * returns the safe fallback (defaults to '#' or empty string).
 */
export const sanitizeUrl = (url: unknown, fallback = '#'): string => {
  if (isSafeUrl(url)) {
    return (url as string).trim();
  }
  return fallback;
};
