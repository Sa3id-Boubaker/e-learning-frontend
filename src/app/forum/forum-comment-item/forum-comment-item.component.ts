import { ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { IconService } from '@ant-design/icons-angular';
import { DeleteOutline, EditOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { formatSessionDateTime } from '../../trainings/format-session-date-time';
import { canManageForumResource } from '../forum-permissions';
import { ForumAuthorSummary, ForumCommentResponse } from '../models/forum.models';
import { ForumService } from '../forum.service';

/** Same shape as ForumPostCardComponent — owns its own edit (inline) / delete (confirm modal) and emits the result upward. */
@Component({
  selector: 'app-forum-comment-item',
  imports: [SharedModule, ReactiveFormsModule, DeleteConfirmationModalComponent],
  templateUrl: './forum-comment-item.component.html',
  styleUrl: './forum-comment-item.component.scss'
})
export class ForumCommentItemComponent {
  private readonly forumService = inject(ForumService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input({ required: true }) comment!: ForumCommentResponse;
  @Input() currentUser: UserProfileResponse | null = null;

  @Output() readonly updated = new EventEmitter<ForumCommentResponse>();
  @Output() readonly deleted = new EventEmitter<string>();

  editing = false;
  saving = false;
  readonly bodyControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  deleteModalOpen = false;
  deleteLoading = false;

  readonly formatSessionDateTime = formatSessionDateTime;

  constructor() {
    this.iconService.addIcon(...[EditOutline, DeleteOutline]);
  }

  get canManage(): boolean {
    return canManageForumResource(this.comment.author, this.currentUser);
  }

  initialsFor(author: ForumAuthorSummary): string {
    const first = author.firstName?.charAt(0) ?? '';
    const last = author.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  startEdit(): void {
    this.editing = true;
    this.bodyControl.setValue(this.comment.body);
  }

  cancelEdit(): void {
    this.editing = false;
  }

  saveEdit(): void {
    if (this.saving || this.bodyControl.invalid) {
      return;
    }

    this.saving = true;
    const body = this.bodyControl.value;

    this.forumService.updateComment(this.comment.id, { body }).subscribe({
      next: (updated) => {
        this.saving = false;
        this.editing = false;
        this.cdr.markForCheck();
        this.updated.emit(updated);
      },
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('forum.commentItem.updateError'));
      }
    });
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
    const commentId = this.comment.id;

    this.forumService.deleteComment(commentId).subscribe({
      next: () => {
        this.deleteLoading = false;
        this.deleteModalOpen = false;
        this.cdr.markForCheck();
        this.deleted.emit(commentId);
      },
      error: (error) => {
        this.deleteLoading = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('forum.commentItem.deleteError'));
      }
    });
  }
}
