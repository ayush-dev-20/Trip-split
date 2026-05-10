/** Format a money amount with currency symbol/code. */
export function formatMoney(amount: number, currency: string = 'USD', options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Compact money formatting (e.g. ₹12.5K, $1.2M). */
export function formatMoneyCompact(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

/** Format date as "Mar 5" or "Mar 5, 2024" if not current year. */
export function formatDate(date: string | Date, opts?: { withYear?: boolean }): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(opts?.withYear || !sameYear ? { year: 'numeric' } : {}),
  });
}

/** "Today", "Yesterday", or formatted date. */
export function formatRelativeDay(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - dDate.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 0 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return formatDate(d);
}

/** "5m ago", "2h ago", "3d ago". */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

/** Get initials from a name (max 2 characters). */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
