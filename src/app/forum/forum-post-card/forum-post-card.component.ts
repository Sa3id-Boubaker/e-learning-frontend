import { ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconService } from '@ant-design/icons-angular';
import { DeleteOutline, EditOutline, LikeOutline, MessageOutline, StarOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { formatSessionDateTime } from '../../trainings/format-session-date-time';
import { canManageForumResource } from '../forum-permissions';
import { ForumAuthorSummary, ForumPostResponse } from '../models/forum.models';
import { ForumService } from '../forum.service';

const BODY_EXCERPT_LENGTH = 140;

/**
 * One post in the list. Owns its own bookmark/upvote/delete calls and its own delete-confirmation
 * modal (same as e.g. RecordingSectionComponent owning its own delete flow). Bookmark/upvote use
 * optimistic UI, emitting the updated post back up rather than mutating its own @Input() —
 * mutating post.bookmarked locally would just get overwritten by the parent's next
 * change-detection pass, since the parent's array still holds the original object. Editing is
 * requested upward too (editRequested) since the edit form is one shared modal instance owned by
 * the list, not one per card.
 */
@Component({
  selector: 'app-forum-post-card',
  imports: [SharedModule, RouterLink, DeleteConfirmationModalComponent],
  templateUrl: './forum-post-card.component.html',
  styleUrl: './forum-post-card.component.scss'
})
export class ForumPostCardComponent {
  private readonly forumService = inject(ForumService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input({ required: true }) post!: ForumPostResponse;
  @Input() currentUser: UserProfileResponse | null = null;
  // false on the detail page itself (already there — the title shouldn't link to itself).
  @Input() clickable = true;

  @Output() readonly changed = new EventEmitter<ForumPostResponse>();
  @Output() readonly editRequested = new EventEmitter<ForumPostResponse>();
  @Output() readonly deleted = new EventEmitter<string>();

  bookmarkToggling = false;
  upvoteToggling = false;

  deleteModalOpen = false;
  deleteLoading = false;

  readonly formatSessionDateTime = formatSessionDateTime;

  constructor() {
    this.iconService.addIcon(...[StarOutline, LikeOutline, MessageOutline, EditOutline, DeleteOutline]);
  }

  get canManage(): boolean {
    return canManageForumResource(this.post.author, this.currentUser);
  }

  get bodyExcerpt(): string {
    const body = this.post.body;
    return body.length > BODY_EXCERPT_LENGTH ? `${body.slice(0, BODY_EXCERPT_LENGTH)}…` : body;
  }

  /** The single course/training-side reference this post is actually about, most-specific first. */
  get referenceLabel(): string {
    if (this.post.type === 'COURSE') {
      return this.post.video?.title ?? this.post.chapter?.title ?? this.post.course?.title ?? '';
    }

    return this.post.liveSession?.title ?? this.post.training?.title ?? '';
  }

  initialsFor(author: ForumAuthorSummary): string {
    const first = author.firstName?.charAt(0) ?? '';
    const last = author.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  toggleBookmark(): void {
    if (this.bookmarkToggling) {
      return;
    }

    const original = this.post;
    const optimistic: ForumPostResponse = { ...original, bookmarked: !original.bookmarked };
    this.bookmarkToggling = true;
    this.changed.emit(optimistic);

    const request$ = original.bookmarked ? this.forumService.unbookmark(original.id) : this.forumService.bookmark(original.id);

    request$.subscribe({
      next: () => {
        this.bookmarkToggling = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.bookmarkToggling = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401 || status === 409) {
          // 409 means the server already had this in the target state (a race from a double
          // click, or another tab) — the optimistic value we just emitted already matches it.
          return;
        }

        this.changed.emit(original);
        this.toastService.error(this.translateService.instant('forum.postCard.bookmarkError'));
      }
    });
  }

  toggleUpvote(): void {
    if (this.upvoteToggling) {
      return;
    }

    const original = this.post;
    const optimistic: ForumPostResponse = {
      ...original,
      upvoted: !original.upvoted,
      upvoteCount: original.upvoted ? Math.max(0, original.upvoteCount - 1) : original.upvoteCount + 1
    };
    this.upvoteToggling = true;
    this.changed.emit(optimistic);

    const request$ = original.upvoted ? this.forumService.removeUpvote(original.id) : this.forumService.upvote(original.id);

    request$.subscribe({
      next: () => {
        this.upvoteToggling = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.upvoteToggling = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401 || status === 409) {
          return;
        }

        this.changed.emit(original);
        this.toastService.error(this.translateService.instant('forum.postCard.upvoteError'));
      }
    });
  }

  requestEdit(): void {
    this.editRequested.emit(this.post);
  }

  openDeleteModal(): void {
    this.deleteModalOpen = true;
  }

  onDeleteModalClosed(): void {
    if (this.deleteLoading) {
      return;
    }

    this.deleteModalOpen = false;
  }

  confirmDelete(): void {
    if (this.deleteLoading) {
      return;
    }

    this.deleteLoading = true;
    const postId = this.post.id;

    this.forumService.deletePost(postId).subscribe({
      next: () => {
        this.deleteLoading = false;
        this.deleteModalOpen = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('forum.postCard.postDeleted'));
        this.deleted.emit(postId);
      },
      error: (error) => {
        this.deleteLoading = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('forum.postCard.deleteError'));
      }
    });
  }
}
