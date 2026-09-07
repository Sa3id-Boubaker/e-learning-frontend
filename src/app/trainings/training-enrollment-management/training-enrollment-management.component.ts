import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { CheckCircleOutline, CloseCircleOutline, DeleteOutline, PlusOutline, SearchOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AdminUserService } from '../../admin/admin-user.service';
import { AdminUserResponse } from '../../admin/models/admin-user.models';
import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { formatSessionDateTime } from '../format-session-date-time';
import { getTrainingEnrollmentStatusBadgeClass, getTrainingEnrollmentStatusLabel } from '../training-enrollment-status';
import { TrainingEnrollmentResponse, TrainingEnrollmentStatus } from '../models/training-enrollment.models';
import { TrainingEnrollmentFormModalComponent } from '../training-enrollment-form-modal/training-enrollment-form-modal.component';
import { TrainingEnrollmentService } from '../training-enrollment.service';
import { TrainingResponse } from '../models/training.models';
import { TrainingService } from '../training.service';

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_RESULT_LIMIT = 5;

@Component({
  selector: 'app-training-enrollment-management',
  imports: [SharedModule, RouterLink, TrainingEnrollmentFormModalComponent, DeleteConfirmationModalComponent],
  templateUrl: './training-enrollment-management.component.html',
  styleUrl: './training-enrollment-management.component.scss'
})
export class TrainingEnrollmentManagementComponent implements OnInit, OnDestroy {
  private readonly adminUserService = inject(AdminUserService);
  private readonly trainingService = inject(TrainingService);
  private readonly trainingEnrollmentService = inject(TrainingEnrollmentService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;

  // Same rationale as elsewhere in this app (EnrollmentManagementComponent, CourseDetailComponent):
  // currentUser$ can still be at its initial `null` the instant this component initializes on a
  // hard refresh, so this is a live subscription guarded by an idempotent dataRequested flag
  // rather than a one-shot read.
  accessChecked = false;
  isAdmin = false;
  private dataRequested = false;

  enrollments: TrainingEnrollmentResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  // Training filter — unfiltered by status, unlike the "New enrollment" modal's dropdown: browsing
  // enrollment history for a since-completed or cancelled training is still a valid thing to do.
  trainings: TrainingResponse[] = [];
  readonly trainingFilterControl = new FormControl('', { nonNullable: true });

  // Revoked enrollments are a soft-delete kept for history — default the filter to Active so
  // they don't clutter the table; "All"/"Revoked" stay selectable for admins who want them.
  readonly statusFilterControl = new FormControl('ACTIVE', { nonNullable: true });

  readonly studentFilterSearchControl = new FormControl('', { nonNullable: true });
  studentFilterResults: AdminUserResponse[] = [];
  studentFilterSearching = false;
  studentFilterResultsOpen = false;
  selectedStudentFilter: AdminUserResponse | null = null;

  newEnrollmentModalOpen = false;

  revokeModalOpen = false;
  enrollmentPendingRevoke: TrainingEnrollmentResponse | null = null;
  revokeLoading = false;

  readonly getTrainingEnrollmentStatusLabel = getTrainingEnrollmentStatusLabel;
  readonly getTrainingEnrollmentStatusBadgeClass = getTrainingEnrollmentStatusBadgeClass;
  readonly formatSessionDateTime = formatSessionDateTime;

  constructor() {
    this.iconService.addIcon(...[SearchOutline, DeleteOutline, CheckCircleOutline, PlusOutline, CloseCircleOutline]);

    this.trainingFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFiltersAndReload());
    this.statusFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFiltersAndReload());

    // Same pattern as the "New enrollment" modal's student search: any keystroke invalidates a
    // previous selection immediately, the debounced sibling below handles fetching results.
    this.studentFilterSearchControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.selectedStudentFilter) {
        this.selectedStudentFilter = null;
        this.applyFiltersAndReload();
      }
    });

    this.studentFilterSearchControl.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => this.fetchStudentFilterResults(term));
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

  get revokeModalTitle(): string {
    return this.enrollmentPendingRevoke
      ? this.translateService.instant('trainings.enrollmentManagement.revokeTitleNamed', {
          training: this.enrollmentPendingRevoke.trainingTitle
        })
      : this.translateService.instant('courses.enrollmentManagement.revokeTitleGeneric');
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.isAdmin = user?.role === 'ADMIN';
      this.accessChecked = true;

      if (this.isAdmin && !this.dataRequested) {
        this.dataRequested = true;
        this.loadTrainings();
        this.loadEnrollments();
      }

      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onStudentFilterInputFocus(): void {
    if (this.studentFilterResults.length > 0) {
      this.studentFilterResultsOpen = true;
    }
  }

  onStudentFilterInputBlur(): void {
    setTimeout(() => {
      this.studentFilterResultsOpen = false;
      this.cdr.markForCheck();
    }, 150);
  }

  selectStudentFilter(student: AdminUserResponse): void {
    this.selectedStudentFilter = student;
    this.studentFilterSearchControl.setValue(`${student.firstName} ${student.lastName}`, { emitEvent: false });
    this.studentFilterResultsOpen = false;
    this.studentFilterResults = [];
    this.applyFiltersAndReload();
  }

  clearStudentFilter(): void {
    if (!this.selectedStudentFilter && !this.studentFilterSearchControl.value) {
      return;
    }

    this.selectedStudentFilter = null;
    this.studentFilterSearchControl.setValue('', { emitEvent: false });
    this.studentFilterResults = [];
    this.applyFiltersAndReload();
  }

  loadTrainings(): void {
    this.trainingService.getAllTrainings().subscribe({
      next: (trainings) => {
        this.trainings = trainings;
        this.cdr.markForCheck();
      },
      error: () => {
        // The training filter is a secondary convenience — a failure here shouldn't block the
        // table itself from working, same rationale as the calendar's training filter.
      }
    });
  }

  loadEnrollments(): void {
    this.loading = true;
    this.loadError = '';

    this.trainingEnrollmentService
      .listAllEnrollments(this.currentPage, this.pageSize, {
        trainingId: this.trainingFilterControl.value || undefined,
        studentId: this.selectedStudentFilter?.id || undefined,
        status: (this.statusFilterControl.value as TrainingEnrollmentStatus) || undefined
      })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.enrollments = result.content;
          this.currentPage = result.page;
          this.totalElements = result.totalElements;
          this.totalPages = result.totalPages;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401 || status === 403) {
            return;
          }

          this.loadError =
            (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.enrollmentManagement.loadError');
        }
      });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadEnrollments();
    this.scrollTableToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadEnrollments();
    this.scrollTableToTop();
  }

  openNewEnrollmentModal(): void {
    this.newEnrollmentModalOpen = true;
  }

  onNewEnrollmentModalClosed(): void {
    this.newEnrollmentModalOpen = false;
  }

  onEnrollmentCreated(enrollment: TrainingEnrollmentResponse): void {
    this.newEnrollmentModalOpen = false;

    // createEnrollment is idempotent — resubmitting the same student+training pair returns the
    // SAME document rather than erroring. Checking for its id locally before deciding how to
    // apply it is what keeps that from rendering as a duplicate row: a real re-fetch would always
    // show one row, so the local array must never show two either.
    const existingIndex = this.enrollments.findIndex((existing) => existing.id === enrollment.id);

    if (existingIndex === -1) {
      this.toastService.success(
        this.translateService.instant('trainings.enrollmentManagement.enrollmentCreated', { training: enrollment.trainingTitle })
      );

      if (this.currentPage === 0) {
        this.enrollments = [enrollment, ...this.enrollments].slice(0, this.pageSize);
      }

      this.totalElements += 1;
      this.totalPages = Math.max(this.totalPages, Math.ceil(this.totalElements / this.pageSize));
    } else {
      const wasRevoked = this.enrollments[existingIndex].status === 'REVOKED';

      this.toastService.success(
        this.translateService.instant(
          wasRevoked ? 'trainings.enrollmentManagement.enrollmentReactivated' : 'trainings.enrollmentManagement.alreadyHasAccess',
          { training: enrollment.trainingTitle }
        )
      );

      this.enrollments = this.enrollments.map((existing) => (existing.id === enrollment.id ? enrollment : existing));
    }

    this.cdr.markForCheck();
  }

  openRevokeModal(enrollment: TrainingEnrollmentResponse): void {
    this.enrollmentPendingRevoke = enrollment;
    this.revokeModalOpen = true;
  }

  onRevokeModalClosed(): void {
    if (this.revokeLoading) {
      return;
    }

    this.revokeModalOpen = false;
    this.enrollmentPendingRevoke = null;
  }

  confirmRevoke(): void {
    if (!this.enrollmentPendingRevoke || this.revokeLoading) {
      return;
    }

    this.revokeLoading = true;
    const enrollment = this.enrollmentPendingRevoke;

    this.trainingEnrollmentService
      .revokeEnrollment(enrollment.id)
      .pipe(
        finalize(() => {
          this.revokeLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(
            this.translateService.instant('courses.enrollmentManagement.accessRevoked', { course: enrollment.trainingTitle })
          );
          this.enrollments = this.enrollments.map((existing) =>
            existing.id === enrollment.id ? { ...existing, status: 'REVOKED' as const } : existing
          );
          this.revokeModalOpen = false;
          this.enrollmentPendingRevoke = null;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401 || status === 403) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('courses.enrollmentManagement.revokeError'));
        }
      });
  }

  private applyFiltersAndReload(): void {
    this.currentPage = 0;
    this.loadEnrollments();
  }

  private fetchStudentFilterResults(term: string): void {
    const trimmed = term.trim();

    if (!trimmed) {
      this.studentFilterResults = [];
      this.studentFilterResultsOpen = false;
      return;
    }

    this.studentFilterSearching = true;

    this.adminUserService
      .listStudents(0, SEARCH_RESULT_LIMIT, trimmed)
      .pipe(
        finalize(() => {
          this.studentFilterSearching = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.studentFilterResults = result.content;
          this.studentFilterResultsOpen = true;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401 || status === 403) {
            return;
          }

          this.studentFilterResults = [];
        }
      });
  }

  private scrollTableToTop(): void {
    this.tableContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
