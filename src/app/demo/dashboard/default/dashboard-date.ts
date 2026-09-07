/**
 * Backend dashboard stats send LocalDate as plain "yyyy-MM-dd" strings — parsed by splitting on
 * '-' rather than going through `new Date(...)`, same rationale as trainings/format-session-date-time.ts:
 * avoids a local-timezone round-trip that could silently shift which day a chart label shows.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** e.g. "Aug 28" — no year, sized for a 7-day chart axis label. */
export function formatDashboardDayLabel(value: string): string {
  const parts = value.split('-').map(Number);
  const month = parts[1];
  const day = parts[2];
  return `${MONTH_NAMES[month - 1]} ${day}`;
}
