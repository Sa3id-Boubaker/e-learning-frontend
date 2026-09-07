import { UserProfileResponse } from '../auth/models/auth.models';
import { TrainingResponse } from './models/training.models';

export function canManageTraining(training: TrainingResponse, currentUser: UserProfileResponse | null): boolean {
  if (!currentUser) {
    return false;
  }

  return currentUser.role === 'ADMIN' || training.instructorId === currentUser.id;
}
