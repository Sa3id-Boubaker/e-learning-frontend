import { UserProfileResponse } from '../auth/models/auth.models';
import { ForumAuthorSummary } from './models/forum.models';

/** Same rule for posts and comments — an ADMIN, or whoever authored the resource. */
export function canManageForumResource(author: ForumAuthorSummary, currentUser: UserProfileResponse | null): boolean {
  if (!currentUser) {
    return false;
  }

  return currentUser.role === 'ADMIN' || author.id === currentUser.id;
}
