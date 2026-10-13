/**
 * Formats a Date/timestamp into a consistent 12-hour time format with AM/PM (e.g. "10:29 PM").
 * Handles invalid or missing timestamps safely.
 */
export const format12HourTime = (dateInput: Date | string | number | undefined | null): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};
