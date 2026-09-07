import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { formatSessionDate } from '../../trainings/format-session-date-time';
import { getEnrollmentStatusBadgeClass, getEnrollmentStatusLabel } from '../enrollment-status';
import { CourseService } from '../course.service';
import { EnrollmentService } from '../enrollment.service';
import { CourseResponse } from '../models/course.models';
import { EnrollmentResponse } from '../models/enrollment.models';

@Component({
  selector: 'app-course-enrolled-students',
  imports: [SharedModule, RouterLink],
  templateUrl: './course-enrolled-students.component.html',
  styleUrl: './course-enrolled-students.component.scss'
})
export class CourseEnrolledStudentsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;

  loading = true;
  notFound = false;
  accessDenied = false;
  loadError = '';

  course: CourseResponse | null = null;
  enrollments: EnrollmentResponse[] = [];

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  private courseId = '';

  readonly getEnrollmentStatusLabel = getEnrollmentStatusLabel;
  readonly getEnrollmentStatusBadgeClass = getEnrollmentStatusBadgeClass;
  readonly formatSessionDate = formatSessionDate;

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
    this.courseId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadCourse();
  }

  loadCourse(): void {
    if (!this.courseId) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    this.loading = true;
    this.loadError = '';
    this.notFound = false;
    this.accessDenied = false;

    this.courseService.getCourseById(this.courseId).subscribe({
      next: (course) => {
        this.course = course;
        this.loadEnrollments();
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

  loadEnrollments(): void {
    this.loading = true;
    this.loadError = '';
    this.accessDenied = false;

    this.enrollmentService.listCourseEnrollments(this.courseId, this.currentPage, this.pageSize).subscribe({
      next: (result) => {
        this.loading = false;
        this.enrollments = result.content;
        this.currentPage = result.page;
        this.totalElements = result.totalElements;
        this.totalPages = result.totalPages;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        const status = error?.status as number | undefined;

        if (status === 401) {
          this.cdr.markForCheck();
          return;
        }

        if (status === 403) {
          this.accessDenied = true;
          this.cdr.markForCheck();
          return;
        }

        this.loadError =
          (error?.error as ApiErrorResponse | undefined)?.message ??
          this.translateService.instant('courses.enrolledStudents.loadError');
        this.cdr.markForCheck();
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

  private scrollTableToTop(): void {
    this.tableContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
