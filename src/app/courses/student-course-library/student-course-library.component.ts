import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { CheckCircleOutline, PictureOutline, TrophyOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { getCategoryIcon } from '../category-icon';
import { EnrollmentService } from '../enrollment.service';
import { MyCourseResponse } from '../models/enrollment.models';

@Component({
  selector: 'app-student-course-library',
  imports: [SharedModule, RouterLink],
  templateUrl: './student-course-library.component.html',
  styleUrl: './student-course-library.component.scss'
})
export class StudentCourseLibraryComponent implements OnInit, OnDestroy {
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('gridContainer') gridContainer?: ElementRef<HTMLElement>;

  // Same rationale as elsewhere in this app (AllCertificatesComponent, CourseDetailComponent):
  // currentUser$ can still be at its initial `null` the instant this component initializes on
  // a hard refresh, so this is a live subscription guarded by an idempotent dataRequested flag
  // rather than a one-shot read.
  accessChecked = false;
  isStudent = false;
  private dataRequested = false;

  courses: MyCourseResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  readonly getCategoryIcon = getCategoryIcon;

  constructor() {
    this.iconService.addIcon(...[PictureOutline, TrophyOutline, CheckCircleOutline]);
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
      this.isStudent = user?.role === 'ETUDIANT';
      this.accessChecked = true;

      if (this.isStudent && !this.dataRequested) {
        this.dataRequested = true;
        this.loadCourses();
      }

      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCourses(): void {
    this.loading = true;
    this.loadError = '';

    this.enrollmentService.getMyCourses(this.currentPage, this.pageSize).subscribe({
      next: (result) => {
        this.loading = false;
        this.courses = result.content;
        this.currentPage = result.page;
        this.totalElements = result.totalElements;
        this.totalPages = result.totalPages;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        this.loadError =
          (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.studentLibrary.loadError');
      }
    });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadCourses();
    this.scrollGridToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadCourses();
    this.scrollGridToTop();
  }

  openCourse(course: MyCourseResponse): void {
    void this.router.navigateByUrl(`/courses/${course.courseId}`);
  }

  private scrollGridToTop(): void {
    this.gridContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
