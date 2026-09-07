import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import {
  DeleteOutline,
  EditOutline,
  PercentageOutline,
  PictureOutline,
  PlusOutline,
  SafetyCertificateOutline,
  SearchOutline,
  TeamOutline
} from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { CourseFormModalComponent, CourseFormModalMode } from '../course-form-modal/course-form-modal.component';
import { CourseService } from '../course.service';
import { DiscountModalComponent } from '../discount-modal/discount-modal.component';
import { CourseResponse } from '../models/course.models';
import { PriceDisplayComponent } from '../price-display/price-display.component';

const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-my-courses',
  imports: [SharedModule, CourseFormModalComponent, DeleteConfirmationModalComponent, DiscountModalComponent, PriceDisplayComponent],
  templateUrl: './my-courses.component.html',
  styleUrl: './my-courses.component.scss'
})
export class MyCoursesComponent implements OnInit, OnDestroy {
  private readonly courseService = inject(CourseService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;

  // The backend now scopes this endpoint per role server-side (own courses for FORMATEUR,
  // published-only for ETUDIANT, everything for ADMIN) — no client-side filtering needed.
  courses: CourseResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  readonly searchControl = new FormControl('', { nonNullable: true });
  searchTerm = '';
  searching = false;

  formModalOpen = false;
  formModalMode: CourseFormModalMode = 'create';
  selectedCourse: CourseResponse | null = null;

  deleteModalOpen = false;
  coursePendingDelete: CourseResponse | null = null;
  deleteLoading = false;

  discountModalOpen = false;
  discountModalCourse: CourseResponse | null = null;

  private readonly togglingCourseIds = new Set<string>();

  private currentUser: UserProfileResponse | null = null;

  constructor() {
    this.iconService.addIcon(
      ...[EditOutline, DeleteOutline, PlusOutline, PictureOutline, SearchOutline, PercentageOutline, SafetyCertificateOutline, TeamOutline]
    );

    this.searchControl.valueChanges.pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe((term) => {
      this.searchTerm = term;
      this.currentPage = 0;
      this.loadCourses({ isSearch: true });
    });
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

  get deleteModalTitle(): string {
    return this.coursePendingDelete
      ? this.translateService.instant('courses.myCourses.deleteTitleNamed', { title: this.coursePendingDelete.title })
      : this.translateService.instant('courses.myCourses.deleteTitleGeneric');
  }

  get isAdminView(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  instructorLabel(course: CourseResponse): string {
    if (course.instructorFirstName && course.instructorLastName) {
      return `${course.instructorFirstName} ${course.instructorLastName}`;
    }

    return '—';
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });

    this.loadCourses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCourses(options: { isSearch?: boolean } = {}): void {
    const isSearch = options.isSearch === true;

    if (isSearch) {
      this.searching = true;
    } else {
      this.loading = true;
      this.loadError = '';
    }

    this.courseService
      .getAllCourses(this.searchTerm, this.currentPage, this.pageSize)
      .pipe(
        finalize(() => {
          if (isSearch) {
            this.searching = false;
          } else {
            this.loading = false;
          }
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.courses = result.content;
          this.currentPage = result.page;
          this.totalElements = result.totalElements;
          this.totalPages = result.totalPages;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const message = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.list.loadError');

          if (isSearch) {
            this.toastService.error(message);
          } else {
            this.loadError = message;
          }
        }
      });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadCourses();
    this.scrollTableToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadCourses();
    this.scrollTableToTop();
  }

  openCourseDetail(course: CourseResponse): void {
    void this.router.navigateByUrl(`/courses/${course.id}`);
  }

  openCourseCertificates(course: CourseResponse): void {
    void this.router.navigateByUrl(`/courses/${course.id}/certificates`);
  }

  openCourseEnrolledStudents(course: CourseResponse): void {
    void this.router.navigateByUrl(`/courses/${course.id}/students`);
  }

  openCreateModal(): void {
    this.formModalMode = 'create';
    this.selectedCourse = null;
    this.formModalOpen = true;
  }

  openEditModal(course: CourseResponse): void {
    this.formModalMode = 'edit';
    this.selectedCourse = course;
    this.formModalOpen = true;
  }

  onFormModalClosed(): void {
    this.formModalOpen = false;
  }

  onCourseSaved(): void {
    this.formModalOpen = false;
    this.loadCourses();
  }

  openDeleteModal(course: CourseResponse): void {
    this.coursePendingDelete = course;
    this.deleteModalOpen = true;
  }

  onDeleteModalClosed(): void {
    if (this.deleteLoading) {
      return;
    }

    this.deleteModalOpen = false;
    this.coursePendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.coursePendingDelete || this.deleteLoading) {
      return;
    }

    this.deleteLoading = true;
    const course = this.coursePendingDelete;

    this.courseService
      .deleteCourse(course.id)
      .pipe(
        finalize(() => {
          this.deleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('courses.myCourses.courseDeleted', { title: course.title }));
          this.deleteModalOpen = false;
          this.coursePendingDelete = null;

          // Deleting the last remaining item on a page beyond the first steps back a page
          // rather than refetching into an empty page (same rule as the admin users list).
          if (this.currentPage > 0 && this.courses.length === 1) {
            this.currentPage -= 1;
          }

          this.loadCourses();
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

  openDiscountModal(course: CourseResponse): void {
    this.discountModalCourse = course;
    this.discountModalOpen = true;
  }

  onDiscountModalClosed(): void {
    this.discountModalOpen = false;
    this.discountModalCourse = null;
  }

  onDiscountSaved(updated: CourseResponse): void {
    this.courses = this.courses.map((existing) => (existing.id === updated.id ? this.mergeCourseUpdate(existing, updated) : existing));
    this.discountModalOpen = false;
    this.discountModalCourse = null;
    this.cdr.markForCheck();
  }

  isToggling(course: CourseResponse): boolean {
    return this.togglingCourseIds.has(course.id);
  }

  onTogglePublished(course: CourseResponse): void {
    if (this.togglingCourseIds.has(course.id)) {
      return;
    }

    const previousPublished = course.published;
    const nextPublished = !previousPublished;

    this.togglingCourseIds.add(course.id);
    this.courses = this.courses.map((existing) => (existing.id === course.id ? { ...existing, published: nextPublished } : existing));

    this.courseService.updateCourse(course.id, { published: nextPublished }).subscribe({
      next: (updated) => {
        this.togglingCourseIds.delete(course.id);
        this.courses = this.courses.map((existing) => (existing.id === updated.id ? this.mergeCourseUpdate(existing, updated) : existing));
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.togglingCourseIds.delete(course.id);
        this.courses = this.courses.map((existing) => (existing.id === course.id ? { ...existing, published: previousPublished } : existing));
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('courses.myCourses.updateStatusError'));
      }
    });
  }

  /**
   * The discount/publish-toggle endpoints don't echo back instructor name fields the way the
   * paginated list endpoint does — merging onto the existing row (instead of replacing it
   * outright) keeps "Created by" from blanking out until the next full page load.
   */
  private mergeCourseUpdate(existing: CourseResponse, updated: CourseResponse): CourseResponse {
    return {
      ...existing,
      ...updated,
      instructorFirstName: existing.instructorFirstName,
      instructorLastName: existing.instructorLastName,
      instructorEmail: existing.instructorEmail
    };
  }

  private scrollTableToTop(): void {
    this.tableContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
