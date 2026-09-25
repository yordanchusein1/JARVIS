/** Daily schedules in the agency's time zone, using only the built-in Intl time zone data. */

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** How far `timeZone` is ahead of UTC at `date`, in milliseconds. */
function offsetAt(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const wholeSeconds = date.getTime() - date.getUTCMilliseconds();
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - wholeSeconds;
}

/** The instant at which the clock in `timeZone` shows `hour`:00 on the given local day. */
function atLocalHour(year: number, month: number, day: number, hour: number, timeZone: string) {
  const wallClock = Date.UTC(year, month - 1, day, hour);
  const first = wallClock - offsetAt(new Date(wallClock), timeZone);
  // Recheck with the offset at the result, in case a daylight saving change lies in between.
  return new Date(wallClock - offsetAt(new Date(first), timeZone));
}

function slotOnDay(now: Date, dayShift: number, hour: number, timeZone: string): Date {
  const { year, month, day } = localParts(now, timeZone);
  const shifted = new Date(Date.UTC(year, month - 1, day + dayShift));
  return atLocalHour(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    hour,
    timeZone,
  );
}

/** The most recent time, at or before `now`, when the local clock showed `hour`:00. */
export function latestSlot(now: Date, hour: number, timeZone: string): Date {
  const today = slotOnDay(now, 0, hour, timeZone);
  return today <= now ? today : slotOnDay(now, -1, hour, timeZone);
}

/** The next time, after `now`, when the local clock shows `hour`:00. */
export function nextSlot(now: Date, hour: number, timeZone: string): Date {
  const today = slotOnDay(now, 0, hour, timeZone);
  return today > now ? today : slotOnDay(now, 1, hour, timeZone);
}
