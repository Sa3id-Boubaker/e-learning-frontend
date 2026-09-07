import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { FilterOutline, InboxOutline, UserOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { CourseService } from '../../courses/course.service';
import { CourseResponse } from '../../courses/models/course.models';
import { TrainingService } from '../../trainings/training.service';
import { TrainingResponse } from '../../trainings/models/training.models';
import { FORUM_POST_TYPE_OPTIONS, getForumPostTypeLabel } from '../forum-post-type';
import { ForumPostCardComponent } from '../forum-post-card/forum-post-card.component';
import { ForumPostFormModalComponent } from '../forum-post-form-modal/forum-post-form-modal.component';
import { ForumPostResponse, ForumPostType } from '../models/forum.models';
import { ForumService } from '../forum.service';

const CATALOG_PAGE_SIZE = 100;

type ForumTab = 'recent' | 'popular' | 'bookmarked';

@Component({
  selector: 'app-forum-list',
  imports: [SharedModule, ForumPostCardComponent, ForumPostFormModalComponent],
  templateUrl: './forum-list.component.html',
  styleUrl: './forum-list.component.scss'
})
export class ForumListComponent implements OnInit, OnDestroy {
  private readonly forumService = inject(ForumService);
  private readonly courseService = inject(CourseService);
  private readonly trainingService = inject(TrainingService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('listContainer') listContainer?: ElementRef<HTMLElement>;

  currentUser: UserProfileResponse | null = null;

  activeTab: ForumTab = 'recent';

  posts: ForumPostResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  filtersOpen = false;
  readonly typeFilterControl = new FormControl('', { nonNullable: true });
  readonly courseFilterControl = new FormControl('', { nonNullable: true });
  readonly trainingFilterControl = new FormControl('', { nonNullable: true });
  filterCourses: CourseResponse[] = [];
  filterTrainings: TrainingResponse[] = [];

  postModalOpen = false;
  editingPost: ForumPostResponse | null = null;

  readonly typeOptions = FORUM_POST_TYPE_OPTIONS;
  readonly getForumPostTypeLabel = getForumPostTypeLabel;

  constructor() {
    this.iconService.addIcon(...[InboxOutline, FilterOutline, UserOutline]);

    this.typeFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.courseFilterControl.setValue('', { emitEvent: false });
      this.trainingFilterControl.setValue('', { emitEvent: false });
      this.applyFiltersAndReload();
    });

    this.courseFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFiltersAndReload());
    this.trainingFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFiltersAndReload());
  }

  get pageStart(): number {
    return this.totalElements === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 0;
  }

  get hasNextPage(): boolean {
    return this.currentPage + 1 < this.totalPages;
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });

    this.loadPosts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initialsFor(user: UserProfileResponse): string {
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  switchTab(tab: ForumTab): void {
    if (tab === this.activeTab) {
      return;
    }

    this.activeTab = tab;
    this.filtersOpen = false;
    this.currentPage = 0;
    this.loadPosts();
  }

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;

    if (this.filtersOpen && this.filterCourses.length === 0) {
      this.loadFilterCourses();
    }

    if (this.filtersOpen && this.filterTrainings.length === 0) {
      this.loadFilterTrainings();
    }
  }

  loadPosts(): void {
    this.loading = true;
    this.loadError = '';

    const request$ =
      this.activeTab === 'bookmarked'
        ? this.forumService.listBookmarked(this.currentPage, this.pageSize)
        : this.forumService.listPosts(this.activeTab === 'popular' ? 'popular' : 'recent', this.currentPage, this.pageSize, {
            type: (this.typeFilterControl.value as ForumPostType) || undefined,
            courseId: this.courseFilterControl.value || undefined,
            trainingId: this.trainingFilterControl.value || undefined
          });

    request$
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.posts = result.content;
          this.currentPage = result.page;
          this.totalElements = result.totalElements;
          this.totalPages = result.totalPages;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.loadError = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('forum.list.loadError');
        }
      });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadPosts();
    this.scrollListToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadPosts();
    this.scrollListToTop();
  }

  openCreateModal(): void {
    this.editingPost = null;
    this.postModalOpen = true;
  }

  openEditModal(post: ForumPostResponse): void {
    this.editingPost = post;
    this.postModalOpen = true;
  }

  onPostModalClosed(): void {
    this.postModalOpen = false;
    this.editingPost = null;
  }

  onPostSaved(post: ForumPostResponse): void {
    this.postModalOpen = false;
    this.editingPost = null;

    const existingIndex = this.posts.findIndex((existing) => existing.id === post.id);

    if (existingIndex !== -1) {
      // An edit — the post is already on the current page, just replace it in place.
      this.posts = this.posts.map((existing) => (existing.id === post.id ? post : existing));
      this.cdr.markForCheck();
      return;
    }

    // A freshly created post only belongs at the top of "All" (createdAt-sorted) — on "Top"
    // (upvote-sorted, a brand new post has 0 upvotes) or "Bookmarked" it wouldn't actually be
    // the right place for it, so just reload those tabs instead of guessing where it'd land.
    if (this.activeTab === 'recent') {
      this.posts = [post, ...this.posts].slice(0, this.pageSize);
      this.totalElements += 1;
      this.totalPages = Math.max(this.totalPages, Math.ceil(this.totalElements / this.pageSize));
      this.cdr.markForCheck();
    } else {
      this.loadPosts();
    }
  }

  onPostChanged(updated: ForumPostResponse): void {
    if (this.activeTab === 'bookmarked' && !updated.bookmarked) {
      this.posts = this.posts.filter((existing) => existing.id !== updated.id);
      this.totalElements = Math.max(0, this.totalElements - 1);
    } else {
      this.posts = this.posts.map((existing) => (existing.id === updated.id ? updated : existing));
    }

    this.cdr.markForCheck();
  }

  onPostDeleted(postId: string): void {
    this.posts = this.posts.filter((existing) => existing.id !== postId);
    this.totalElements = Math.max(0, this.totalElements - 1);
    this.cdr.markForCheck();
  }

  private applyFiltersAndReload(): void {
    this.currentPage = 0;
    this.loadPosts();
  }

  private loadFilterCourses(): void {
    this.courseService.getAllCourses('', 0, CATALOG_PAGE_SIZE).subscribe({
      next: (result) => {
        this.filterCourses = result.content;
        this.cdr.markForCheck();
      },
      error: () => {
        // Secondary convenience — a failure here shouldn't block the list itself.
      }
    });
  }

  private loadFilterTrainings(): void {
    this.trainingService.getAllTrainings().subscribe({
      next: (trainings) => {
        this.filterTrainings = trainings;
        this.cdr.markForCheck();
      },
      error: () => {
        // Same fail-quiet treatment as loadFilterCourses().
      }
    });
  }

  private scrollListToTop(): void {
    this.listContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
