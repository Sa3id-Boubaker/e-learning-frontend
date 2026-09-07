import { ForumPostType } from './models/forum.models';

// Keys, not literal text — piped through `translate` at each call site.
const TYPE_LABELS: Record<ForumPostType, string> = {
  COURSE: 'forum.postType.course',
  TRAINING: 'forum.postType.training'
};

export function getForumPostTypeLabel(type: ForumPostType): string {
  return TYPE_LABELS[type] ?? type;
}

export const FORUM_POST_TYPE_OPTIONS: ForumPostType[] = ['COURSE', 'TRAINING'];
