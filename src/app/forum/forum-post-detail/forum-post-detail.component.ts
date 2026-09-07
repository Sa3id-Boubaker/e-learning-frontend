import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { ArrowLeftOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { ForumCommentItemComponent } from '../forum-comment-item/forum-comment-item.component';
import { ForumPostCardComponent } from '../forum-post-card/forum-post-card.component';
import { ForumPostFormModalComponent } from '../forum-post-form-modal/forum-post-form-modal.component';
import { ForumCommentResponse, ForumPostResponse } from '../models/forum.models';
import { ForumService } from '../forum.service';

@Component({
  selector: 'app-forum-post-detail',
  imports: [SharedModule, ReactiveFormsModule, RouterLink, ForumPostCardComponent, ForumCommentItemComponent, ForumPostFormModalComponent],
  templateUrl: './forum-post-detail.component.html',
  styleUrl: './forum-post-detail.component.scss'
})
export class ForumPostDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly forumService = inject(ForumService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('commentsContainer') commentsContainer?: ElementRef<HTMLElement>;

  private postId = '';
  currentUser: UserProfileResponse | null = null;

  post: ForumPostResponse | null = null;
  loading = false;
  notFound = false;
  loadError = '';

  comments: ForumCommentResponse[] = [];
  commentsLoading = false;
  commentsLoadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  readonly commentBodyControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  submittingComment = false;

  editModalOpen = false;

  constructor() {
    this.iconService.addIcon(...[ArrowLeftOutline]);
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 0;
  }

  get hasNextPage(): boolean {
    return this.currentPage + 1 < this.totalPages;
  }

  ngOnInit(): void {
    this.postId = this.route.snapshot.paramMap.get('id') ?? '';

    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });

    this.loadPost();
    this.loadComments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPost(): void {
    if (!this.postId) {
      this.notFound = true;
      return;
    }

    this.loading = true;
    this.notFound = false;
    this.loadError = '';

    this.forumService
      .getPostById(this.postId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (post) => {
          this.post = post;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          if (status === 404) {
            this.notFound = true;
            return;
          }

          this.loadError = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('forum.postDetail.loadError');
        }
      });
  }

  loadComments(): void {
    if (!this.postId) {
      return;
    }

    this.commentsLoading = true;
    this.commentsLoadError = '';

    this.forumService
      .listComments(this.postId, this.currentPage, this.pageSize)
      .pipe(
        finalize(() => {
          this.commentsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.comments = result.content;
          this.currentPage = result.page;
          this.totalElements = result.totalElements;
          this.totalPages = result.totalPages;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.commentsLoadError =
            (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('forum.postDetail.loadCommentsError');
        }
      });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.commentsLoading) {
      return;
    }

    this.currentPage -= 1;
    this.loadComments();
    this.scrollCommentsToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.commentsLoading) {
      return;
    }

    this.currentPage += 1;
    this.loadComments();
    this.scrollCommentsToTop();
  }

  onPostChanged(updated: ForumPostResponse): void {
    this.post = updated;
    this.cdr.markForCheck();
  }

  openEditModal(): void {
    this.editModalOpen = true;
  }

  onEditModalClosed(): void {
    this.editModalOpen = false;
  }

  onPostSaved(updated: ForumPostResponse): void {
    this.post = updated;
    this.editModalOpen = false;
    this.cdr.markForCheck();
  }

  onPostDeleted(): void {
    // The card already shows its own "Post deleted." toast — nothing left to stay on here.
    void this.router.navigateByUrl('/forum');
  }

  submitComment(): void {
    if (this.commentBodyControl.invalid || this.submittingComment || !this.post) {
      return;
    }

    this.submittingComment = true;
    const body = this.commentBodyControl.value;
    const post = this.post;

    this.forumService
      .createComment(post.id, { body })
      .pipe(
        finalize(() => {
          this.submittingComment = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.commentBodyControl.setValue('');
          this.post = { ...post, commentCount: post.commentCount + 1 };
          this.totalElements += 1;
          this.totalPages = Math.max(this.totalPages, Math.ceil(this.totalElements / this.pageSize));

          // Oldest-first order — a new comment always belongs on the last page, so jump there to
          // show it rather than leaving the user looking at whatever page they were already on.
          this.currentPage = this.totalPages - 1;
          this.loadComments();
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('forum.postDetail.submitCommentError'));
        }
      });
  }

  onCommentUpdated(updated: ForumCommentResponse): void {
    this.comments = this.comments.map((existing) => (existing.id === updated.id ? updated : existing));
    this.cdr.markForCheck();
  }

  onCommentDeleted(commentId: string): void {
    this.comments = this.comments.filter((existing) => existing.id !== commentId);
    this.totalElements = Math.max(0, this.totalElements - 1);

    if (this.post) {
      this.post = { ...this.post, commentCount: Math.max(0, this.post.commentCount - 1) };
    }

    this.cdr.markForCheck();
  }

  private scrollCommentsToTop(): void {
    this.commentsContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
