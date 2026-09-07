import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { SmileOutline, UploadOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { ChapterService } from '../../courses/chapter.service';
import { ChapterResponse } from '../../courses/models/chapter.models';
import { CourseService } from '../../courses/course.service';
import { CourseResponse } from '../../courses/models/course.models';
import { VideoService } from '../../courses/video.service';
import { VideoResponse } from '../../courses/models/video.models';
import { LiveSessionService } from '../../trainings/live-session.service';
import { LiveSessionResponse } from '../../trainings/models/live-session.models';
import { RecordingService } from '../../trainings/recording.service';
import { RecordingResponse } from '../../trainings/models/recording.models';
import { TrainingService } from '../../trainings/training.service';
import { TrainingResponse } from '../../trainings/models/training.models';
import { FORUM_POST_TYPE_OPTIONS, getForumPostTypeLabel } from '../forum-post-type';
import { ForumPostCreateRequest, ForumPostResponse, ForumPostType, ForumPostUpdateRequest } from '../models/forum.models';
import { ForumService } from '../forum.service';

const CATALOG_PAGE_SIZE = 100;

/**
 * "Create a new post" / "Edit post" — same modal-shell pattern used across this app (backdrop, focus
 * trap, reset-on-open). Course and Training pickers are plain <select>s fed by the same services
 * already used for their respective cascading-select precedents elsewhere in this app; nothing
 * new added to any of those services.
 */
@Component({
  selector: 'app-forum-post-form-modal',
  imports: [SharedModule, ReactiveFormsModule],
  templateUrl: './forum-post-form-modal.component.html',
  styleUrl: './forum-post-form-modal.component.scss'
})
export class ForumPostFormModalComponent implements OnChanges, OnDestroy {
  private readonly courseService = inject(CourseService);
  private readonly chapterService = inject(ChapterService);
  private readonly videoService = inject(VideoService);
  private readonly trainingService = inject(TrainingService);
  private readonly liveSessionService = inject(LiveSessionService);
  private readonly recordingService = inject(RecordingService);
  private readonly forumService = inject(ForumService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @Input() open = false;
  // Set to edit that post (title/body only — type and every reference id are immutable after
  // creation); left null for the normal create flow.
  @Input() editingPost: ForumPostResponse | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<ForumPostResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly titleControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly typeControl = new FormControl<ForumPostType>('COURSE', { nonNullable: true });
  readonly bodyControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  courses: CourseResponse[] = [];
  coursesLoading = false;
  readonly courseControl = new FormControl('', { nonNullable: true });

  chapters: ChapterResponse[] = [];
  chaptersLoading = false;
  readonly chapterControl = new FormControl('', { nonNullable: true });

  videos: VideoResponse[] = [];
  videosLoading = false;
  readonly videoControl = new FormControl('', { nonNullable: true });

  trainings: TrainingResponse[] = [];
  trainingsLoading = false;
  readonly trainingControl = new FormControl('', { nonNullable: true });

  liveSessions: LiveSessionResponse[] = [];
  liveSessionsLoading = false;
  readonly liveSessionControl = new FormControl('', { nonNullable: true });

  // At most one recording per live session — this is a single optional choice, not a real list.
  recording: RecordingResponse | null = null;
  recordingLoading = false;
  readonly recordingControl = new FormControl('', { nonNullable: true });

  submitting = false;
  serverMessage = '';

  readonly typeOptions = FORUM_POST_TYPE_OPTIONS;
  readonly getForumPostTypeLabel = getForumPostTypeLabel;

  constructor() {
    this.iconService.addIcon(...[UploadOutline, SmileOutline]);

    this.typeControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetTypeFields());

    this.courseControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((courseId) => {
      this.chapterControl.setValue('', { emitEvent: false });
      this.videoControl.setValue('', { emitEvent: false });
      this.chapters = [];
      this.videos = [];

      if (courseId) {
        this.loadChapters(courseId);
      }
    });

    this.chapterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((chapterId) => {
      this.videoControl.setValue('', { emitEvent: false });
      this.videos = [];

      if (chapterId) {
        this.loadVideos(chapterId);
      }
    });

    this.trainingControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((trainingId) => {
      this.liveSessionControl.setValue('', { emitEvent: false });
      this.liveSessions = [];
      this.resetRecording();

      if (trainingId) {
        this.loadLiveSessions(trainingId);
      }
    });

    this.liveSessionControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((liveSessionId) => {
      this.resetRecording();

      if (liveSessionId) {
        this.loadRecording(liveSessionId);
      }
    });
  }

  get canSubmit(): boolean {
    if (this.submitting || !this.titleControl.value || !this.bodyControl.value) {
      return false;
    }

    if (this.editingPost) {
      return true;
    }

    return this.typeControl.value === 'COURSE' ? !!this.courseControl.value : !!this.trainingControl.value;
  }

  get modalTitle(): string {
    return this.translateService.instant(this.editingPost ? 'forum.postFormModal.editTitle' : 'forum.postFormModal.createTitle');
  }

  get submitLabel(): string {
    if (this.submitting) {
      return this.translateService.instant(this.editingPost ? 'common.saving' : 'forum.postFormModal.publishing');
    }

    return this.translateService.instant(this.editingPost ? 'common.save' : 'forum.postFormModal.publish');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.typeControl.setValue('COURSE', { emitEvent: false });
      this.resetTypeFields();

      if (this.editingPost) {
        // type/course/training/etc. are immutable after creation — only title/body are editable,
        // so the whole cascading-select section stays hidden and its catalogs are never fetched.
        this.titleControl.setValue(this.editingPost.title);
        this.bodyControl.setValue(this.editingPost.body);
      } else {
        this.titleControl.setValue('');
        this.bodyControl.setValue('');

        if (this.courses.length === 0) {
          this.loadCourses();
        }

        if (this.trainings.length === 0) {
          this.loadTrainings();
        }
      }

      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onClose(): void {
    if (this.submitting) {
      return;
    }

    this.closed.emit();
  }

  submit(): void {
    if (!this.canSubmit) {
      return;
    }

    this.serverMessage = '';
    this.submitting = true;

    const request$ = this.editingPost ? this.buildUpdateRequest(this.editingPost) : this.buildCreateRequest();

    request$
      .pipe(
        finalize(() => {
          this.submitting = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (post) => this.saved.emit(post),
        error: (error) => this.handleSaveError(error)
      });
  }

  private buildCreateRequest() {
    const payload: ForumPostCreateRequest =
      this.typeControl.value === 'COURSE'
        ? {
            title: this.titleControl.value,
            type: 'COURSE',
            body: this.bodyControl.value,
            courseId: this.courseControl.value,
            chapterId: this.chapterControl.value || undefined,
            videoId: this.videoControl.value || undefined
          }
        : {
            title: this.titleControl.value,
            type: 'TRAINING',
            body: this.bodyControl.value,
            trainingId: this.trainingControl.value,
            liveSessionId: this.liveSessionControl.value || undefined,
            recordingId: this.recordingControl.value || undefined
          };

    return this.forumService.createPost(payload);
  }

  private buildUpdateRequest(editingPost: ForumPostResponse) {
    const payload: ForumPostUpdateRequest = {
      title: this.titleControl.value,
      body: this.bodyControl.value
    };

    return this.forumService.updatePost(editingPost.id, payload);
  }

  onKeydownTab(event: Event): void {
    const focusable = this.getFocusableElements();

    if (focusable.length === 0) {
      return;
    }

    const keyboardEvent = event as KeyboardEvent;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (keyboardEvent.shiftKey && active === first) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && active === last) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }

  private resetTypeFields(): void {
    this.courseControl.setValue('', { emitEvent: false });
    this.chapterControl.setValue('', { emitEvent: false });
    this.videoControl.setValue('', { emitEvent: false });
    this.chapters = [];
    this.videos = [];

    this.trainingControl.setValue('', { emitEvent: false });
    this.liveSessionControl.setValue('', { emitEvent: false });
    this.liveSessions = [];
    this.resetRecording();
  }

  private resetRecording(): void {
    this.recordingControl.setValue('', { emitEvent: false });
    this.recording = null;
    this.recordingLoading = false;
  }

  private loadCourses(): void {
    this.coursesLoading = true;

    this.courseService
      .getAllCourses('', 0, CATALOG_PAGE_SIZE)
      .pipe(
        finalize(() => {
          this.coursesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.courses = result.content;
        },
        error: () => {
          // The course dropdown is the only way to submit a COURSE-type post — a load failure
          // here just leaves the dropdown empty rather than blocking the whole modal.
        }
      });
  }

  private loadTrainings(): void {
    this.trainingsLoading = true;

    this.trainingService
      .getAllTrainings()
      .pipe(
        finalize(() => {
          this.trainingsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (trainings) => {
          this.trainings = trainings;
        },
        error: () => {
          // Same fail-quiet treatment as loadCourses().
        }
      });
  }

  private loadChapters(courseId: string): void {
    this.chaptersLoading = true;

    this.chapterService
      .getChaptersByCourse(courseId)
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
        error: () => {
          this.chapters = [];
        }
      });
  }

  private loadVideos(chapterId: string): void {
    this.videosLoading = true;

    this.videoService
      .getVideosByChapter(chapterId)
      .pipe(
        finalize(() => {
          this.videosLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (videos) => {
          this.videos = videos;
        },
        error: () => {
          this.videos = [];
        }
      });
  }

  private loadLiveSessions(trainingId: string): void {
    this.liveSessionsLoading = true;

    this.liveSessionService
      .listByTraining(trainingId)
      .pipe(
        finalize(() => {
          this.liveSessionsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (sessions) => {
          this.liveSessions = sessions;
        },
        error: () => {
          this.liveSessions = [];
        }
      });
  }

  /** 404 (no recording) and 403 (not enrolled) both just mean "nothing to offer here" — not errors. */
  private loadRecording(liveSessionId: string): void {
    this.recordingLoading = true;

    this.recordingService
      .getBySession(liveSessionId)
      .pipe(
        finalize(() => {
          this.recordingLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (recording) => {
          this.recording = recording;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.recording = null;
        }
      });
  }

  private handleSaveError(error: unknown): void {
    const httpError = error as { status?: number; error?: ApiErrorResponse };
    const status = httpError?.status;

    if (status === 401) {
      return;
    }

    const apiError = httpError?.error;
    const message = apiError?.message ?? this.fallbackMessageFor(status);
    this.serverMessage = message;
    this.toastService.error(message);
  }

  private fallbackMessageFor(status: number | undefined): string {
    switch (status) {
      case 400:
        return this.translateService.instant('forum.postFormModal.checkReferences');
      case 503:
        return this.translateService.instant('courses.enrollmentModal.serviceUnavailable');
      default:
        return this.translateService.instant('forum.postFormModal.publishError');
    }
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
