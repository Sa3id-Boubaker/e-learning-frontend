/**
 * The backend returns LiveSession/CalendarEvent startAt/endAt as naive "YYYY-MM-DDTHH:mm:ss"
 * strings (no timezone suffix) that already represent the correct wall-clock time. These helpers
 * read the literal digits out of that string instead of going through `new Date(...)` + the
 * Angular `date` pipe — parsing a naive string with `Date` (and formatting it back with `Intl`)
 * relies on the runtime's local timezone twice, which is harmless when both happen to agree but
 * silently shifts the displayed time whenever they don't. Splitting the string sidesteps that
 * entirely: the numbers shown are exactly the numbers received.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface NaiveDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function parseNaiveDateTime(value: string): NaiveDateTime {
  const [datePart, timePart = '00:00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hourStr, minuteStr, secondStr = '0'] = timePart.split(':');
  return { year, month, day, hour: Number(hourStr), minute: Number(minuteStr), second: Number(secondStr) };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** e.g. "15:11" — 24h, no AM/PM. */
export function formatSessionTime(value: string): string {
  const { hour, minute } = parseNaiveDateTime(value);
  return `${pad(hour)}:${pad(minute)}`;
}

/** e.g. "Aug 31, 2026, 15:11:00" — 24h, no AM/PM. */
export function formatSessionDateTime(value: string): string {
  const { year, month, day, hour, minute, second } = parseNaiveDateTime(value);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}, ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/** e.g. "Aug 31, 2026" — date only, for plain LocalDate values (no time component to parse). */
export function formatSessionDate(value: string): string {
  const { year, month, day } = parseNaiveDateTime(value);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

/** e.g. "Sep" — for a compact calendar-style date badge (paired with formatSessionDayNumber). */
export function formatSessionMonthAbbrev(value: string): string {
  const { month } = parseNaiveDateTime(value);
  return MONTH_NAMES[month - 1];
}

/** e.g. "4" — for a compact calendar-style date badge (paired with formatSessionMonthAbbrev). */
export function formatSessionDayNumber(value: string): string {
  const { day } = parseNaiveDateTime(value);
  return String(day);
}
