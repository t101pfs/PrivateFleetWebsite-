/** Formats an elapsed/remaining duration, scaling the unit so long gaps read
 * as "11d 18h" instead of raw minutes:seconds like "16976:35". Shared by
 * every countdown/elapsed-time display in the app (Operations Timeline,
 * post-quotation workflow timers, etc). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
