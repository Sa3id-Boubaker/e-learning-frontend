import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import {
  CalendarOutline,
  CameraOutline,
  DeleteOutline,
  EditOutline,
  FolderOpenOutline,
  LinkOutline,
  LockOutline,
  PictureOutline,
  PlusOutline,
  VideoCameraOutline
} from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { validateAvatarFile as validateImageFile } from '../../profile/avatar-file-validation';
import { LiveSessionService } from '../live-session.service';
import { getLiveSessionStatusBadgeClass, getLiveSessionStatusLabel, isJoinableLiveSessionStatus } from '../live-session-status';
import { formatSessionDateTime } from '../format-session-date-time';
import { LiveSessionResponse } from '../models/live-session.models';
import { RecordingSectionComponent } from '../recording-section/recording-section.component';
import { canManageTraining } from '../training-permissions';
import { getTrainingStatusBadgeClass, getTrainingStatusLabel } from '../training-status';
import { TrainingAccessResponse } from '../models/training-enrollment.models';
import { TrainingEnrollmentService } from '../training-enrollment.service';
import { TrainingPriceDisplayComponent } from '../training-price-display/training-price-display.component';
import { TrainingResponse } from '../models/training.models';
import { TrainingService } from '../training.service';

@Component({
  selector: 'app-training-detail',
  imports: [SharedModule, RouterLink, DeleteConfirmationModalComponent, TrainingPriceDisplayComponent, RecordingSectionComponent],
  templateUrl: './training-detail.component.html',
  styleUrl: './training-detail.component.scss'
})
export class TrainingDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly trainingService = inject(TrainingService);
  private readonly liveSessionService = inject(LiveSessionService);
  private readonly trainingEnrollmentService = inject(TrainingEnrollmentService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;

  readonly currentUser$ = this.authService.currentUser$;

  training: TrainingResponse | null = null;
  loading = false;
  notFound = false;
  accessDenied = false;
  loadError = '';

  deleteModalOpen = false;
  deleteLoading = false;

  replacingImage = false;
  imageError = '';

  readonly getTrainingStatusLabel = getTrainingStatusLabel;
  readonly getTrainingStatusBadgeClass = getTrainingStatusBadgeClass;

  // Live Sessions — a secondary section layered on top of the page, same spirit as
  // CourseDetailComponent's progress bar: it never gates the main `loading` flag. A 403 here
  // (documented as possible even once the training itself loaded) just hides the section
  // entirely rather than showing an error, per requirement.
  sessions: LiveSessionResponse[] = [];
  sessionsVisible = true;
  sessionsLoading = false;

  // Fired alongside loadSessions() — independent of role (the backend always returns
  // enrolled: true for ADMIN/FORMATEUR-owner), so gating purely on `!trainingAccess.enrolled`
  // naturally only ever triggers for a genuinely unenrolled ETUDIANT. Same fail-open rationale as
  // CourseDetailComponent.checkCourseAccess(): a check failure shouldn't strand the tabs hidden.
  trainingAccess: TrainingAccessResponse | null = null;

  sessionDeleteModalOpen = false;
  sessionPendingDelete: LiveSessionResponse | null = null;
  sessionDeleteLoading = false;

  readonly getLiveSessionStatusLabel = getLiveSessionStatusLabel;
  readonly getLiveSessionStatusBadgeClass = getLiveSessionStatusBadgeClass;
  readonly isJoinableLiveSessionStatus = isJoinableLiveSessionStatus;
  readonly formatSessionDateTime = formatSessionDateTime;

  // Sessions ("Calendrier"-style scheduling) and Recordings (replay viewing/management) used to
  // be mixed into one list — split into tabs, same nav-tabs pattern as AdminUsersComponent.
  activeTab: 'sessions' | 'recordings' = 'sessions';

  // Each completed session's RecordingSectionComponent self-checks whether it has a recording
  // and reports back via (resolved) — these track that, purely to know when to show the
  // Recordings tab's empty state (a session with no recording renders nothing on its own).
  private recordingResolvedIds = new Set<string>();
  private recordingHasContentIds = new Set<string>();

  private trainingId = '';

  constructor() {
    this.iconService.addIcon(
      ...[
        EditOutline,
        DeleteOutline,
        PictureOutline,
        CameraOutline,
        CalendarOutline,
        PlusOutline,
        LinkOutline,
        VideoCameraOutline,
        FolderOpenOutline,
        LockOutline
      ]
    );
  }

  ngOnInit(): void {
    this.trainingId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadTraining();
  }

  canManage(user: UserProfileResponse | null): boolean {
    return !!this.training && canManageTraining(this.training, user);
  }

  get enrollmentGateActive(): boolean {
    return !!this.trainingAccess && !this.trainingAccess.enrolled;
  }

  switchTab(tab: 'sessions' | 'recordings'): void {
    if (tab === this.activeTab) {
      return;
    }

    this.activeTab = tab;
  }

  get completedSessionIds(): string[] {
    return this.sessions.filter((session) => session.status === 'COMPLETED').map((session) => session.id);
  }

  get recordingsChecking(): boolean {
    return this.completedSessionIds.some((id) => !this.recordingResolvedIds.has(id));
  }

  get recordingsTabEmpty(): boolean {
    return !this.recordingsChecking && this.recordingHasContentIds.size === 0;
  }

  onRecordingSectionResolved(sessionId: string, hasContent: boolean): void {
    this.recordingResolvedIds.add(sessionId);

    if (hasContent) {
      this.recordingHasContentIds.add(sessionId);
    } else {
      this.recordingHasContentIds.delete(sessionId);
    }

    this.cdr.markForCheck();
  }

  loadTraining(): void {
    if (!this.trainingId) {
      this.notFound = true;
      return;
    }

    this.loading = true;
    this.notFound = false;
    this.accessDenied = false;
    this.loadError = '';

    this.trainingService
      .getTrainingById(this.trainingId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (training) => {
          this.training = training;
          this.loadSessions();
          this.checkTrainingAccess();
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

          if (status === 403) {
            this.accessDenied = true;
            return;
          }

          this.loadError =
            (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('trainings.detail.loadError');
        }
      });
  }

  openEditPage(): void {
    if (!this.training) {
      return;
    }

    void this.router.navigateByUrl(`/trainings/${this.training.id}/edit`);
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
    if (!this.training || this.deleteLoading) {
      return;
    }

    this.deleteLoading = true;
    const training = this.training;

    this.trainingService
      .deleteTraining(training.id)
      .pipe(
        finalize(() => {
          this.deleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('trainings.list.trainingDeleted', { title: training.title }));
          void this.router.navigateByUrl('/trainings');
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('trainings.list.deleteError'));
        }
      });
  }

  openImagePicker(): void {
    this.imageInput?.nativeElement.click();
  }

  onImageFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || !this.training) {
      return;
    }

    this.imageError = '';
    const validationError = validateImageFile(file);

    if (validationError) {
      this.imageError = validationError;
      return;
    }

    this.replacingImage = true;

    this.trainingService
      .replaceTrainingImage(this.training.id, file)
      .pipe(
        finalize(() => {
          this.replacingImage = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (updated) => {
          this.training = updated;
          this.toastService.success(this.translateService.instant('trainings.detail.imageUpdated'));
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('trainings.detail.imageUpdateError'));
        }
      });
  }

  loadSessions(): void {
    this.sessionsLoading = true;

    this.liveSessionService
      .listByTraining(this.trainingId)
      .pipe(
        finalize(() => {
          this.sessionsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (sessions) => {
          this.sessions = sessions;
          this.sessionsVisible = true;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          if (status === 403) {
            this.sessionsVisible = false;
            return;
          }

          // Sessions are a secondary section — a load failure here shouldn't block the rest of
          // the page, just leave the section empty rather than showing a hard error.
        }
      });
  }

  private checkTrainingAccess(): void {
    if (!this.trainingId) {
      return;
    }

    this.trainingEnrollmentService.checkAccess(this.trainingId).subscribe({
      next: (access) => {
        this.trainingAccess = access;
        this.cdr.markForCheck();
      },
      error: (error) => {
        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        // Fail open: an access-check hiccup shouldn't strand the tabs hidden behind the
        // enrollment gate — treat as enrolled, same as CourseDetailComponent's own fallback.
        this.trainingAccess = { trainingId: this.trainingId, enrolled: true, status: null };
        this.cdr.markForCheck();
      }
    });
  }

  openAddSessionPage(): void {
    void this.router.navigateByUrl(`/trainings/${this.trainingId}/sessions/new`);
  }

  openEditSessionPage(session: LiveSessionResponse): void {
    void this.router.navigateByUrl(`/trainings/${this.trainingId}/sessions/${session.id}/edit`);
  }

  openSessionDeleteModal(session: LiveSessionResponse): void {
    this.sessionPendingDelete = session;
    this.sessionDeleteModalOpen = true;
  }

  onSessionDeleteModalClosed(): void {
    if (this.sessionDeleteLoading) {
      return;
    }

    this.sessionDeleteModalOpen = false;
    this.sessionPendingDelete = null;
  }

  confirmDeleteSession(): void {
    if (!this.sessionPendingDelete || this.sessionDeleteLoading) {
      return;
    }

    this.sessionDeleteLoading = true;
    const session = this.sessionPendingDelete;

    this.liveSessionService
      .delete(session.id)
      .pipe(
        finalize(() => {
          this.sessionDeleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('trainings.detail.sessionDeleted', { title: session.title }));
          this.sessionDeleteModalOpen = false;
          this.sessionPendingDelete = null;
          this.sessions = this.sessions.filter((existing) => existing.id !== session.id);
          this.recordingResolvedIds.delete(session.id);
          this.recordingHasContentIds.delete(session.id);
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('trainings.detail.deleteSessionError'));
        }
      });
  }
}
