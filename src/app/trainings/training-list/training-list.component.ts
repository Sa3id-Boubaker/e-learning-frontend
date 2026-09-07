import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { DeleteOutline, EditOutline, PictureOutline, PlusOutline, TeamOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { canManageTraining } from '../training-permissions';
import { TrainingPriceDisplayComponent } from '../training-price-display/training-price-display.component';
import { TrainingPurchaseModalComponent } from '../training-purchase-modal/training-purchase-modal.component';
import { TrainingDeletionImpactResponse, TrainingResponse } from '../models/training.models';
import { TrainingService } from '../training.service';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Component({
  selector: 'app-training-list',
  imports: [SharedModule, DeleteConfirmationModalComponent, TrainingPriceDisplayComponent, TrainingPurchaseModalComponent],
  templateUrl: './training-list.component.html',
  styleUrl: './training-list.component.scss'
})
export class TrainingListComponent implements OnInit, OnDestroy {
  private readonly trainingService = inject(TrainingService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  // The backend scopes this endpoint per role server-side (own trainings for FORMATEUR,
  // PUBLISHED-only for ETUDIANT, everything for ADMIN) — no client-side filtering needed.
  trainings: TrainingResponse[] = [];
  loading = false;
  loadError = '';

  deleteModalOpen = false;
  trainingPendingDelete: TrainingResponse | null = null;
  deleteLoading = false;
  deletionImpact: TrainingDeletionImpactResponse | null = null;
  deletionImpactLoading = false;

  purchaseModalOpen = false;
  trainingForPurchase: TrainingResponse | null = null;

  // instructorId -> "First Last", resolved lazily via AuthService.getUserBasicInfo since
  // TrainingResponse only carries the raw id. ADMIN-only: the only role viewing trainings
  // across multiple different formateurs, so it's the only one that needs this.
  instructorNames: Record<string, string> = {};

  private currentUser: UserProfileResponse | null = null;

  constructor() {
    this.iconService.addIcon(...[EditOutline, DeleteOutline, PlusOutline, PictureOutline, TeamOutline]);
  }

  get deleteModalTitle(): string {
    return this.trainingPendingDelete
      ? this.translateService.instant('trainings.list.deleteTitleNamed', { title: this.trainingPendingDelete.title })
      : this.translateService.instant('trainings.list.deleteTitleGeneric');
  }

  get deleteModalDescription(): string {
    if (this.deletionImpactLoading) {
      return this.translateService.instant('trainings.list.checkingImpact');
    }

    const impact = this.deletionImpact;

    if (!impact || (impact.liveSessionCount === 0 && impact.recordingCount === 0 && impact.totalEnrollmentCount === 0)) {
      return this.translateService.instant('common.actionCannotBeUndone');
    }

    const parts: string[] = [];

    if (impact.liveSessionCount > 0) {
      parts.push(
        this.translateService.instant(impact.liveSessionCount === 1 ? 'trainings.list.liveSessionSingular' : 'trainings.list.liveSessionPlural', {
          count: impact.liveSessionCount
        })
      );
    }

    if (impact.recordingCount > 0) {
      parts.push(
        this.translateService.instant(impact.recordingCount === 1 ? 'trainings.list.recordingSingular' : 'trainings.list.recordingPlural', {
          count: impact.recordingCount
        })
      );
    }

    if (impact.totalEnrollmentCount > 0) {
      const activeSuffix =
        impact.activeEnrollmentCount > 0
          ? this.translateService.instant('trainings.list.activeSuffix', { count: impact.activeEnrollmentCount })
          : '';
      parts.push(
        this.translateService.instant(impact.totalEnrollmentCount === 1 ? 'trainings.list.enrollmentSingular' : 'trainings.list.enrollmentPlural', {
          count: impact.totalEnrollmentCount,
          activeSuffix
        })
      );
    }

    return this.translateService.instant('trainings.list.deletionImpactBody', { parts: this.joinWithAnd(parts) });
  }

  /** Gates the whole Actions column and the "Create Training" button — ETUDIANT never manages anything. */
  get canManageAny(): boolean {
    return this.currentUser?.role === 'ADMIN' || this.currentUser?.role === 'FORMATEUR';
  }

  get isStudent(): boolean {
    return this.currentUser?.role === 'ETUDIANT';
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  canManage(training: TrainingResponse): boolean {
    return canManageTraining(training, this.currentUser);
  }

  /** Whole-day span between startDate and endDate — the backend has no separate duration field. */
  getDurationDays(training: TrainingResponse): number {
    const start = new Date(training.startDate).getTime();
    const end = new Date(training.endDate).getTime();
    return Math.max(0, Math.round((end - start) / MS_PER_DAY));
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.cdr.markForCheck();
      this.maybeLoadInstructorNames();
    });

    this.loadTrainings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTrainings(): void {
    this.loading = true;
    this.loadError = '';

    this.trainingService
      .getAllTrainings()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.trainings = result;
          this.maybeLoadInstructorNames();
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.loadError =
            (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('trainings.list.loadError');
        }
      });
  }

  /**
   * Idempotent — safe to call from both the currentUser$ subscription and loadTrainings()'s
   * success handler regardless of which resolves first, and only fetches names not already
   * resolved. Each lookup fails quietly (leaves that row blank) so one bad id can't block the rest.
   */
  private maybeLoadInstructorNames(): void {
    if (!this.isAdmin || this.trainings.length === 0) {
      return;
    }

    const missingIds = Array.from(
      new Set(this.trainings.map((training) => training.instructorId).filter((id) => !this.instructorNames[id]))
    );

    missingIds.forEach((id) => {
      this.authService.getUserBasicInfo(id).subscribe({
        next: (user) => {
          this.instructorNames = { ...this.instructorNames, [id]: `${user.firstName} ${user.lastName}` };
          this.cdr.markForCheck();
        },
        error: () => {
          // Fail quiet — that row's Instructor cell just stays blank.
        }
      });
    });
  }

  openTrainingDetail(training: TrainingResponse): void {
    void this.router.navigateByUrl(`/trainings/${training.id}`);
  }

  openCreatePage(): void {
    void this.router.navigateByUrl('/trainings/new');
  }

  openEditPage(training: TrainingResponse): void {
    void this.router.navigateByUrl(`/trainings/${training.id}/edit`);
  }

  openTrainingEnrolledStudents(training: TrainingResponse): void {
    void this.router.navigateByUrl(`/trainings/${training.id}/students`);
  }

  openDeleteModal(training: TrainingResponse): void {
    this.trainingPendingDelete = training;
    this.deleteModalOpen = true;
    this.deletionImpact = null;
    this.deletionImpactLoading = true;

    this.trainingService
      .getDeletionImpact(training.id)
      .pipe(
        finalize(() => {
          this.deletionImpactLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (impact) => {
          this.deletionImpact = impact;
        },
        error: () => {
          // Purely informational — if the preview call fails, fall back to the plain
          // confirmation message rather than blocking an otherwise-working delete flow.
          this.deletionImpact = null;
        }
      });
  }

  openPurchaseModal(training: TrainingResponse): void {
    this.trainingForPurchase = training;
    this.purchaseModalOpen = true;
  }

  onPurchaseModalClosed(): void {
    this.purchaseModalOpen = false;
    this.trainingForPurchase = null;
  }

  onDeleteModalClosed(): void {
    if (this.deleteLoading) {
      return;
    }

    this.deleteModalOpen = false;
    this.trainingPendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.trainingPendingDelete || this.deleteLoading) {
      return;
    }

    this.deleteLoading = true;
    const training = this.trainingPendingDelete;

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
          this.deleteModalOpen = false;
          this.trainingPendingDelete = null;
          this.trainings = this.trainings.filter((existing) => existing.id !== training.id);
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

  private joinWithAnd(parts: string[]): string {
    if (parts.length <= 1) {
      return parts.join('');
    }

    const and = this.translateService.instant('trainings.list.andJoiner');

    if (parts.length === 2) {
      return `${parts[0]} ${and} ${parts[1]}`;
    }

    return `${parts.slice(0, -1).join(', ')}, ${and} ${parts[parts.length - 1]}`;
  }
}
