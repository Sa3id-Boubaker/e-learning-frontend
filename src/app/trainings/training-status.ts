import { TrainingStatus } from './models/training.models';

// Keys, not literal text — piped through `translate` at each call site.
const STATUS_LABELS: Record<TrainingStatus, string> = {
  DRAFT: 'trainings.status.draft',
  PUBLISHED: 'trainings.status.published',
  IN_PROGRESS: 'trainings.status.inProgress',
  COMPLETED: 'trainings.status.completed',
  CANCELLED: 'trainings.status.cancelled'
};

const STATUS_BADGE_CLASSES: Record<TrainingStatus, string> = {
  DRAFT: 'bg-light-secondary text-secondary',
  PUBLISHED: 'bg-light-success text-success',
  IN_PROGRESS: 'bg-light-primary text-primary',
  COMPLETED: 'bg-light-info text-info',
  CANCELLED: 'bg-light-danger text-danger'
};

export function getTrainingStatusLabel(status: TrainingStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function getTrainingStatusBadgeClass(status: TrainingStatus): string {
  return STATUS_BADGE_CLASSES[status] ?? 'bg-light-secondary text-secondary';
}

/** All possible values, for places that need to enumerate them (e.g. filters) — not the form, which now only offers Publish/Cancel actions. */
export const TRAINING_STATUS_OPTIONS: TrainingStatus[] = ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
