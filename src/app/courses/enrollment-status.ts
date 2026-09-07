import { EnrollmentResponse } from './models/enrollment.models';

type EnrollmentStatus = EnrollmentResponse['enrollmentStatus'];

// Keys, not literal text — piped through `translate` at each call site, same pattern used for
// nav labels elsewhere in the app.
const STATUS_LABEL_KEYS: Record<EnrollmentStatus, string> = {
  ACTIVE: 'courses.enrollmentStatus.active',
  REVOKED: 'courses.enrollmentStatus.revoked'
};

const STATUS_BADGE_CLASSES: Record<EnrollmentStatus, string> = {
  ACTIVE: 'bg-light-success text-success',
  REVOKED: 'bg-light-danger text-danger'
};

export function getEnrollmentStatusLabel(status: EnrollmentStatus): string {
  return STATUS_LABEL_KEYS[status] ?? status;
}

export function getEnrollmentStatusBadgeClass(status: EnrollmentStatus): string {
  return STATUS_BADGE_CLASSES[status] ?? 'bg-light-secondary text-secondary';
}
