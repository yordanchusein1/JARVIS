const DAY = 24 * 60 * 60 * 1000;

function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** "Today 07:00", "Tomorrow 07:00" or "Fri 26 Sep, 07:00" in the agency's time zone. */
export function formatWhen(iso: string, timeZone: string, now = new Date()): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  const day = localDay(date, timeZone);
  if (day === localDay(now, timeZone)) return `Today ${time}`;
  if (day === localDay(new Date(now.getTime() + DAY), timeZone)) return `Tomorrow ${time}`;
  if (day === localDay(new Date(now.getTime() - DAY), timeZone)) return `Yesterday ${time}`;
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  return `${weekday}, ${time}`;
}

export function daysSince(iso: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}

export function greeting(timeZone: string, now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
