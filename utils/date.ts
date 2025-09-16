// utils/date.ts
export function timeAgo(input?: any): string {
  if (!input) return '';
  // Firestore serverTimestamp can be a Timestamp object or ISO
  const date =
    typeof input?.toDate === 'function'
      ? (input.toDate() as Date)
      : typeof input === 'string'
      ? new Date(input)
      : input instanceof Date
      ? input
      : null;

  if (!date || isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}
