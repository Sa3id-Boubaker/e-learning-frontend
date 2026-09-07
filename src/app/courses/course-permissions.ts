import { UserProfileResponse } from '../auth/models/auth.models';
import { CourseResponse } from './models/course.models';

export function canManageCourse(course: CourseResponse, currentUser: UserProfileResponse | null): boolean {
  if (!currentUser) {
    return false;
  }

  return currentUser.role === 'ADMIN' || course.instructorId === currentUser.id;
}
