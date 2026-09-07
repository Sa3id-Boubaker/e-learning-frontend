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
import { formatSessionDate } from '../../trainings/format-session-date-time';
import { CourseService } from '../course.service';
import { CourseEnrollmentFormModalComponent } from '../course-enrollment-form-modal/course-enrollment-form-modal.component';
import { getEnrollmentStatusBadgeClass, getEnrollmentStatusLabel } from '../enrollment-status';
import { EnrollmentService } from '../enrollment.service';
import { EnrollmentResponse } from '../models/enrollment.models';
import { CourseSummary } from '../models/course.models';

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_RESULT_LIMIT = 5;

@Component({
  selector: 'app-enrollment-management',
  imports: [SharedModule, RouterLink, CourseEnrollmentFormModalComponent, DeleteConfirmationModalComponent],
  templateUrl: './enrollment-management.component.html',
  styleUrl: './enrollment-management.component.scss'
})
export class EnrollmentManagementComponent implements OnInit, OnDestroy {
  private readonly adminUserService = inject(AdminUserService);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;

  // Same rationale as elsewhere in this app (TrainingEnrollmentManagementComponent,
  // CourseDetailComponent): currentUser$ can still be at its initial `null` the instant this
  // component initializes on a hard refresh, so this is a live subscription guarded by an
  // idempotent dataRequested flag rather than a one-shot read.
  accessChecked = false;
  isAdmin = false;
  private dataRequested = false;

  enrollments: EnrollmentResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  // Course filter — a plain <select> fed by getAllCourseSummaries() (unpaginated {id, title}),
  // same UX as the Training Enrollment page's Training filter.
  courses: CourseSummary[] = [];
  readonly courseFilterControl = new FormControl('', { nonNullable: true });

  readonly studentFilterSearchControl = new FormControl('', { nonNullable: true });
  studentFilterResults: AdminUserResponse[] = [];
  studentFilterSearching = false;
  studentFilterResultsOpen = false;
  selectedStudentFilter: AdminUserResponse | null = null;

  // Revoked enrollments are a soft-delete kept for history — default the filter to Active so
  // they don't clutter the table; "All"/"Revoked" stay selectable for admins who want them.
  readonly statusFilterControl = new FormControl('ACTIVE', { nonNullable: true });

  newEnrollmentModalOpen = false;

  revokeModalOpen = false;
  enrollmentPendingRevoke: EnrollmentResponse | null = null;
  revokeLoading = false;

  readonly getEnrollmentStatusLabel = getEnrollmentStatusLabel;
  readonly getEnrollmentStatusBadgeClass = getEnrollmentStatusBadgeClass;
  readonly formatSessionDate = formatSessionDate;

  constructor() {
    this.iconService.addIcon(...[SearchOutline, DeleteOutline, CheckCircleOutline, PlusOutline, CloseCircleOutline]);

    this.courseFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFiltersAndReload());

    this.studentFilterSearchControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.selectedStudentFilter) {
        this.selectedStudentFilter = null;
        this.applyFiltersAndReload();
      }
    });

    this.studentFilterSearchControl.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => this.fetchStudentFilterResults(term));

    this.statusFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFiltersAndReload());
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
      ? this.translateService.instant('courses.enrollmentManagement.revokeTitleNamed', {
          course: this.enrollmentPendingRevoke.courseTitle
        })
      : this.translateService.instant('courses.enrollmentManagement.revokeTitleGeneric');
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.isAdmin = user?.role === 'ADMIN';
      this.accessChecked = true;

      if (this.isAdmin && !this.dataRequested) {
        this.dataRequested = true;
        this.loadCourseSummaries();
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

  loadCourseSummaries(): void {
    this.courseService.getAllCourseSummaries().subscribe({
      next: (courses) => {
        this.courses = courses;
        this.cdr.markForCheck();
      },
      error: () => {
        // The course filter is a secondary convenience — a failure here shouldn't block the
        // table itself from working, same rationale as the Training filter's loadTrainings().
      }
    });
  }

  loadEnrollments(): void {
    this.loading = true;
    this.loadError = '';

    this.enrollmentService
      .listAllEnrollments(this.currentPage, this.pageSize, {
        courseId: this.courseFilterControl.value || undefined,
        studentId: this.selectedStudentFilter?.id || undefined,
        status: (this.statusFilterControl.value as EnrollmentResponse['enrollmentStatus']) || undefined
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

  onEnrollmentCreated(enrollment: EnrollmentResponse): void {
    this.newEnrollmentModalOpen = false;

    // createEnrollment is idempotent — resubmitting the same student+course pair returns the
    // SAME document rather than erroring. Checking for its id locally before deciding how to
    // apply it is what keeps that from rendering as a duplicate row: a real re-fetch would always
    // show one row, so the local array must never show two either.
    const existingIndex = this.enrollments.findIndex((existing) => existing.id === enrollment.id);

    if (existingIndex === -1) {
      this.toastService.success(
        this.translateService.instant('courses.enrollmentManagement.accessActivated', { course: enrollment.courseTitle })
      );

      if (this.currentPage === 0) {
        this.enrollments = [enrollment, ...this.enrollments].slice(0, this.pageSize);
      }

      this.totalElements += 1;
      this.totalPages = Math.max(this.totalPages, Math.ceil(this.totalElements / this.pageSize));
    } else {
      const wasRevoked = this.enrollments[existingIndex].enrollmentStatus === 'REVOKED';

      this.toastService.success(
        this.translateService.instant(
          wasRevoked ? 'courses.enrollmentManagement.accessReactivated' : 'courses.enrollmentManagement.alreadyHasAccess',
          { course: enrollment.courseTitle }
        )
      );

      this.enrollments = this.enrollments.map((existing) => (existing.id === enrollment.id ? enrollment : existing));
    }

    this.cdr.markForCheck();
  }

  openRevokeModal(enrollment: EnrollmentResponse): void {
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

    this.enrollmentService
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
            this.translateService.instant('courses.enrollmentManagement.accessRevoked', { course: enrollment.courseTitle })
          );
          this.enrollments = this.enrollments.map((existing) =>
            existing.id === enrollment.id ? { ...existing, enrollmentStatus: 'REVOKED' as const } : existing
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
