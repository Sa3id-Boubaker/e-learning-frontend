import { LiveSessionStatus } from './models/live-session.models';

// Keys, not literal text — piped through `translate` at each call site.
const STATUS_LABELS: Record<LiveSessionStatus, string> = {
  SCHEDULED: 'trainings.liveSessionStatus.scheduled',
  LIVE: 'trainings.liveSessionStatus.live',
  COMPLETED: 'trainings.status.completed',
  CANCELLED: 'trainings.status.cancelled'
};

const STATUS_BADGE_CLASSES: Record<LiveSessionStatus, string> = {
  SCHEDULED: 'bg-light-primary text-primary',
  LIVE: 'bg-light-success text-success',
  COMPLETED: 'bg-light-info text-info',
  CANCELLED: 'bg-light-danger text-danger'
};

export function getLiveSessionStatusLabel(status: LiveSessionStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function getLiveSessionStatusBadgeClass(status: LiveSessionStatus): string {
  return STATUS_BADGE_CLASSES[status] ?? 'bg-light-secondary text-secondary';
}

/** Once a session is COMPLETED or CANCELLED there's nothing left to join — only SCHEDULED/LIVE sessions offer a "Join meeting" link. */
export function isJoinableLiveSessionStatus(status: LiveSessionStatus): boolean {
  return status === 'SCHEDULED' || status === 'LIVE';
}

/** All possible values, for places that need to enumerate them (e.g. the calendar's status filter) — not the form, which now only offers a Cancel/Reactivate action. */
export const LIVE_SESSION_STATUS_OPTIONS: LiveSessionStatus[] = ['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED'];
