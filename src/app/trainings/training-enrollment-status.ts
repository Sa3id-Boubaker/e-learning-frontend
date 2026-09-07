import { TrainingEnrollmentStatus } from './models/training-enrollment.models';

// Keys, not literal text — piped through `translate` at each call site. Reuses the courses
// module's enrollment-status keys since the English text is identical either way.
const STATUS_LABEL_KEYS: Record<TrainingEnrollmentStatus, string> = {
  ACTIVE: 'courses.enrollmentStatus.active',
  REVOKED: 'courses.enrollmentStatus.revoked'
};

const STATUS_BADGE_CLASSES: Record<TrainingEnrollmentStatus, string> = {
  ACTIVE: 'bg-light-success text-success',
  REVOKED: 'bg-light-danger text-danger'
};

export function getTrainingEnrollmentStatusLabel(status: TrainingEnrollmentStatus): string {
  return STATUS_LABEL_KEYS[status] ?? status;
}

export function getTrainingEnrollmentStatusBadgeClass(status: TrainingEnrollmentStatus): string {
  return STATUS_BADGE_CLASSES[status] ?? 'bg-light-secondary text-secondary';
}
