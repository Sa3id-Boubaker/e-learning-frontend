import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, finalize, forkJoin, of, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import {
  BgColorsOutline,
  BookOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  CloudServerOutline,
  CodeOutline,
  DatabaseOutline,
  DeleteOutline,
  EditOutline,
  FolderOpenOutline,
  FormOutline,
  LockOutline,
  MobileOutline,
  PlayCircleOutline,
  PlusOutline,
  TrophyOutline,
  UnlockOutline
} from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { AdminContactComponent } from '../admin-contact/admin-contact.component';
import { ChapterListItemComponent } from '../chapter-list-item/chapter-list-item.component';
import { ChapterFormModalComponent, ChapterFormModalMode } from '../chapter-form-modal/chapter-form-modal.component';
import { ChapterService } from '../chapter.service';
import { CertificateService } from '../certificate.service';
import { CourseFormModalComponent } from '../course-form-modal/course-form-modal.component';
import { canManageCourse } from '../course-permissions';
import { CourseService } from '../course.service';
import { EnrollmentService } from '../enrollment.service';
import { getCategoryIcon } from '../category-icon';
import { formatTotalDuration } from '../format-total-duration';
import { CertificateResponse } from '../models/certificate.models';
import { ChapterResponse } from '../models/chapter.models';
import { CourseAccessResponse } from '../models/enrollment.models';
import { CourseResponse } from '../models/course.models';
import { StudentProgressResponse } from '../models/progress.models';
import { VideoResponse } from '../models/video.models';
import { PriceDisplayComponent } from '../price-display/price-display.component';
import { ProgressService } from '../progress.service';
import { VideoService } from '../video.service';

@Component({
  selector: 'app-course-detail',
  imports: [
    SharedModule,
    RouterLink,
    CourseFormModalComponent,
    DeleteConfirmationModalComponent,
    ChapterFormModalComponent,
    ChapterListItemComponent,
    PriceDisplayComponent,
    AdminContactComponent
  ],
  templateUrl: './course-detail.component.html',
  styleUrl: './course-detail.component.scss'
})
export class CourseDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly courseService = inject(CourseService);
  private readonly chapterService = inject(ChapterService);
  private readonly videoService = inject(VideoService);
  private readonly progressService = inject(ProgressService);
  private readonly certificateService = inject(CertificateService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  readonly currentUser$ = this.authService.currentUser$;

  course: CourseResponse | null = null;
  loading = false;
  notFound = false;
  loadError = '';

  formModalOpen = false;
  deleteModalOpen = false;
  deleteLoading = false;

  chapters: ChapterResponse[] = [];
  // Used only to resync the chapter list in place after a 409 conflict on chapter edit/delete —
  // the initial page load goes through the unified `loading` flow below instead.
  chaptersLoading = false;
  chaptersError = '';

  videosByChapterId: Record<string, VideoResponse[]> = {};
  totalDurationSeconds = 0;
  totalLessonCount = 0;

  chapterFormModalOpen = false;
  chapterFormMode: ChapterFormModalMode = 'create';
  selectedChapter: ChapterResponse | null = null;

  chapterDeleteModalOpen = false;
  chapterPendingDelete: ChapterResponse | null = null;
  chapterDeleteLoading = false;

  // Progress is ETUDIANT-only; fetched once after the initial chapters/videos load and never
  // requested for FORMATEUR/ADMIN, per the backend's role restriction on these endpoints.
  progressLoaded = false;
  progressPercentage = 0;
  completedVideoIds = new Set<string>();
  courseCompleted = false;
  // Fetched in the same pass as progress (see maybeLoadProgress) — null means "not earned yet",
  // which is the normal/expected state for most students, not an error.
  certificate: CertificateResponse | null = null;

  // currentUser$ (a BehaviorSubject) can still hold its initial `null` the moment this
  // component's ngOnInit runs on a hard refresh — the real profile is fetched asynchronously
  // by the nav bar, not by a route guard. maybeLoadProgress() is therefore called from two
  // places: right after the initial chapters/videos load, and again whenever currentUser$
  // emits a (possibly late-arriving) value — both funnel through the same idempotent guard
  // below so progress is never fetched twice.
  private initialLoadComplete = false;
  private progressLoading = false;

  // The sidebar card's own enrollment check — narrower in scope than the chapters-gating one
  // this app briefly had and later removed. Chapters/videos are visible to any student now, but
  // progress/quiz/certificate endpoints still require ACTIVE enrollment and still 403 otherwise.
  // Checked before ever calling getCourseProgress()/getMyCertificateForCourse(), so an
  // unenrolled student's card never issues a request the backend is guaranteed to 403 — it
  // renders its own "enroll to unlock" state directly instead.
  courseAccess: CourseAccessResponse | null = null;
  accessChecked = false;

  private readonly destroy$ = new Subject<void>();
  private currentUser: UserProfileResponse | null = null;
  private courseId = '';

  constructor() {
    this.iconService.addIcon(
      ...[
        EditOutline,
        DeleteOutline,
        PlusOutline,
        ClockCircleOutline,
        PlayCircleOutline,
        CloudServerOutline,
        CodeOutline,
        MobileOutline,
        BgColorsOutline,
        DatabaseOutline,
        BookOutline,
        FolderOpenOutline,
        TrophyOutline,
        FormOutline,
        LockOutline,
        UnlockOutline,
        CheckCircleOutline
      ]
    );
  }

  get nextChapterOrder(): number {
    return this.chapters.length + 1;
  }

  get chapterDeleteModalTitle(): string {
    return this.chapterPendingDelete
      ? this.translateService.instant('courses.detail.deleteChapterTitleNamed', { title: this.chapterPendingDelete.title })
      : this.translateService.instant('courses.detail.deleteChapterTitleGeneric');
  }

  get categoryIconType(): string {
    return this.course ? getCategoryIcon(this.course.category) : 'book';
  }

  get formattedTotalDuration(): string {
    return formatTotalDuration(this.totalDurationSeconds);
  }

  get isStudent(): boolean {
    return this.currentUser?.role === 'ETUDIANT';
  }

  get hasCertificate(): boolean {
    return this.certificate !== null;
  }

  ngOnInit(): void {
    // A live subscription, not take(1): on a hard refresh the real profile (with its role)
    // is fetched asynchronously by the nav bar, not by a route guard, so currentUser$ can
    // still be at its initial `null` the instant this component initializes. Re-checking
    // progress eligibility on every emission is what lets a late-arriving ETUDIANT role
    // still trigger the progress fetch instead of silently missing it forever.
    this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.maybeLoadProgress();
    });

    this.courseId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadCourse();
    this.checkCourseAccess();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCourse(): void {
    if (!this.courseId) {
      this.notFound = true;
      return;
    }

    this.loading = true;
    this.loadError = '';
    this.notFound = false;

    this.courseService.getCourseById(this.courseId).subscribe({
      next: (course) => {
        this.course = course;
        this.loadInitialChaptersAndVideos();
      },
      error: (error) => {
        this.loading = false;
        const status = error?.status as number | undefined;

        if (status === 401) {
          this.cdr.markForCheck();
          return;
        }

        if (status === 404) {
          this.notFound = true;
          this.cdr.markForCheck();
          return;
        }

        this.loadError =
          (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.detail.loadError');
        this.cdr.markForCheck();
      }
    });
  }

  /** Fetches chapters, then every chapter's videos in parallel, before the page renders at all. */
  private loadInitialChaptersAndVideos(): void {
    this.chapterService.getChaptersByCourse(this.courseId).subscribe({
      next: (chapters) => {
        this.chapters = chapters;

        if (chapters.length === 0) {
          this.videosByChapterId = {};
          this.computeTotals();
          this.loading = false;
          this.initialLoadComplete = true;
          this.cdr.markForCheck();
          this.maybeLoadProgress();
          return;
        }

        forkJoin(chapters.map((chapter) => this.videoService.getVideosByChapter(chapter.id))).subscribe({
          next: (videoLists) => {
            const videosByChapterId: Record<string, VideoResponse[]> = {};
            chapters.forEach((chapter, index) => {
              videosByChapterId[chapter.id] = videoLists[index];
            });

            this.videosByChapterId = videosByChapterId;
            this.computeTotals();
            this.loading = false;
            this.initialLoadComplete = true;
            this.cdr.markForCheck();
            this.maybeLoadProgress();
          },
          error: (error) => {
            this.loading = false;
            const status = error?.status as number | undefined;

            if (status === 401) {
              this.cdr.markForCheck();
              return;
            }

            this.loadError = this.translateService.instant('courses.detail.loadError');
            this.cdr.markForCheck();
          }
        });
      },
      error: (error) => {
        this.loading = false;
        const status = error?.status as number | undefined;

        if (status === 401) {
          this.cdr.markForCheck();
          return;
        }

        this.loadError =
          (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.detail.loadError');
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Fired alongside loadCourse() — independent of role/currentUser$ (checkAccess works for any
   * authenticated role and the backend already returns enrolled: true unconditionally for
   * FORMATEUR/ADMIN), so this never needs to wait on anything progress-related.
   */
  private checkCourseAccess(): void {
    if (!this.courseId) {
      return;
    }

    this.enrollmentService.checkAccess(this.courseId).subscribe({
      next: (access) => {
        this.courseAccess = access;
        this.accessChecked = true;
        this.maybeLoadProgress();
        this.cdr.markForCheck();
      },
      error: (error) => {
        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        // Fail open: an access-check hiccup shouldn't strand the card in its skeleton forever
        // either — treat as enrolled and let the progress fetch (already safe on its own) be
        // the real source of truth.
        this.courseAccess = { courseId: this.courseId, enrolled: true, status: null };
        this.accessChecked = true;
        this.maybeLoadProgress();
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Progress is a secondary, ETUDIANT-only enhancement layered on top of the page — it never
   * gates `loading`, and a failed fetch just leaves the progress bar hidden rather than
   * blocking chapters/videos from rendering.
   *
   * Called from three places (right after the initial chapters/videos load, again from the live
   * currentUser$ subscription in case the role arrives late, and again once checkCourseAccess()
   * resolves) — the guards below make calling it from any of them perfectly safe: it's a no-op
   * until the initial load has actually finished, a no-op until the access check has resolved, a
   * no-op once progress has already been "loaded" once (including the not-enrolled short
   * circuit below), and a no-op while a request is already in flight.
   *
   * getCourseProgress()/getMyCertificateForCourse() are enrollment-gated on the backend and 403
   * for an unenrolled student — calling them anyway would depend on the global 403 interceptor
   * to unstick this card, but that interceptor deliberately swallows the error (redirecting
   * instead of rethrowing), so this component's own subscribe() would never receive next() or
   * error() and the skeleton would never resolve. Checking access first avoids ever making that
   * call for an unenrolled student in the first place.
   */
  private maybeLoadProgress(): void {
    if (!this.initialLoadComplete || !this.isStudent || !this.accessChecked || this.progressLoaded || this.progressLoading) {
      return;
    }

    if (this.courseAccess && !this.courseAccess.enrolled) {
      this.progressLoaded = true;
      this.cdr.markForCheck();
      return;
    }

    this.progressLoading = true;

    forkJoin({
      progress: this.progressService.getCourseProgress(this.courseId),
      // Certificate existence is a secondary signal layered on top of progress, same spirit as
      // progress itself — any failure here (404 "not earned yet" or otherwise) just means "no
      // certificate yet" and must never block the progress bar/card from rendering.
      certificate: this.certificateService.getMyCertificateForCourse(this.courseId).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ progress, certificate }) => {
        this.progressLoading = false;
        this.applyProgress(progress, false);
        this.certificate = certificate;
        this.progressLoaded = true;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.progressLoading = false;
        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }
      }
    });
  }

  private applyProgress(progress: StudentProgressResponse, celebrate: boolean): void {
    const wasCompleted = this.courseCompleted;

    this.progressPercentage = progress.progressPercentage;
    this.completedVideoIds = new Set(progress.completedVideoIds);
    this.courseCompleted = progress.completed;

    if (celebrate && !wasCompleted && this.courseCompleted) {
      this.toastService.success(this.translateService.instant('courses.detail.courseCompletedToast'));
    }
  }

  onVideoCompleted(videoId: string): void {
    if (this.completedVideoIds.has(videoId)) {
      return;
    }

    const updated = new Set(this.completedVideoIds);
    updated.add(videoId);
    this.completedVideoIds = updated;

    const wasCompleted = this.courseCompleted;
    this.progressPercentage = this.totalLessonCount > 0 ? Math.round((updated.size / this.totalLessonCount) * 100) : 0;
    this.courseCompleted = this.totalLessonCount > 0 && updated.size >= this.totalLessonCount;

    if (!wasCompleted && this.courseCompleted) {
      this.toastService.success(this.translateService.instant('courses.detail.courseCompletedToast'));
    }

    this.cdr.markForCheck();
  }

  private computeTotals(): void {
    let totalDuration = 0;
    let totalCount = 0;

    for (const chapter of this.chapters) {
      const videos = this.videosByChapterId[chapter.id] ?? [];
      totalCount += videos.length;

      for (const video of videos) {
        totalDuration += video.duration ?? 0;
      }
    }

    this.totalDurationSeconds = totalDuration;
    this.totalLessonCount = totalCount;
  }

  canManage(user: UserProfileResponse | null): boolean {
    return !!this.course && canManageCourse(this.course, user);
  }

  openEditModal(): void {
    this.formModalOpen = true;
  }

  onFormModalClosed(): void {
    this.formModalOpen = false;
  }

  onCourseSaved(course: CourseResponse): void {
    this.course = course;
    this.formModalOpen = false;
    this.cdr.markForCheck();
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
    if (!this.course || this.deleteLoading) {
      return;
    }

    this.deleteLoading = true;

    this.courseService
      .deleteCourse(this.course.id)
      .pipe(
        finalize(() => {
          this.deleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('courses.detail.courseDeleted'));
          void this.router.navigateByUrl('/courses');
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('courses.detail.deleteCourseError'));
        }
      });
  }

  loadChapters(): void {
    if (!this.courseId) {
      return;
    }

    this.chaptersLoading = true;
    this.chaptersError = '';

    this.chapterService
      .getChaptersByCourse(this.courseId)
      .pipe(
        finalize(() => {
          this.chaptersLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (chapters) => {
          this.chapters = chapters;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.chaptersError =
            (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.detail.loadChaptersError');
        }
      });
  }

  openCreateChapterModal(): void {
    this.chapterFormMode = 'create';
    this.selectedChapter = null;
    this.chapterFormModalOpen = true;
  }

  openEditChapterModal(chapter: ChapterResponse): void {
    this.chapterFormMode = 'edit';
    this.selectedChapter = chapter;
    this.chapterFormModalOpen = true;
  }

  onChapterFormModalClosed(): void {
    this.chapterFormModalOpen = false;
  }

  onChapterSaved(chapter: ChapterResponse): void {
    if (this.chapterFormMode === 'create') {
      this.chapters = [...this.chapters, chapter].sort((a, b) => a.order - b.order);
    } else {
      this.chapters = this.chapters.map((existing) => (existing.id === chapter.id ? chapter : existing)).sort((a, b) => a.order - b.order);
    }

    this.chapterFormModalOpen = false;
    this.cdr.markForCheck();
  }

  onChapterFormConflict(): void {
    this.chapterFormModalOpen = false;
    this.loadChapters();
  }

  openDeleteChapterModal(chapter: ChapterResponse): void {
    this.chapterPendingDelete = chapter;
    this.chapterDeleteModalOpen = true;
  }

  onChapterDeleteModalClosed(): void {
    if (this.chapterDeleteLoading) {
      return;
    }

    this.chapterDeleteModalOpen = false;
    this.chapterPendingDelete = null;
  }

  confirmDeleteChapter(): void {
    if (!this.chapterPendingDelete || this.chapterDeleteLoading) {
      return;
    }

    this.chapterDeleteLoading = true;
    const chapter = this.chapterPendingDelete;

    this.chapterService
      .deleteChapter(chapter.id)
      .pipe(
        finalize(() => {
          this.chapterDeleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('courses.detail.chapterDeleted'));
          this.chapters = this.chapters.filter((existing) => existing.id !== chapter.id);
          this.chapterDeleteModalOpen = false;
          this.chapterPendingDelete = null;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('courses.detail.deleteChapterError'));
        }
      });
  }
}
