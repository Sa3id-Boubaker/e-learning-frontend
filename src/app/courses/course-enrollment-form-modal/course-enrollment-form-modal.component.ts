import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, Subject, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { CheckCircleOutline, SearchOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AdminUserService } from '../../admin/admin-user.service';
import { AdminUserResponse } from '../../admin/models/admin-user.models';
import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { CourseService } from '../course.service';
import { EnrollmentService } from '../enrollment.service';
import { EnrollmentResponse } from '../models/enrollment.models';
import { CourseSummary } from '../models/course.models';

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_RESULT_LIMIT = 5;

/**
 * "New enrollment" — structured identically to TrainingEnrollmentFormModalComponent (shell,
 * reset-on-open, focus trap, Course-then-Student field order, Course as a <select> populated
 * from getAllCourseSummaries(), Student as search-and-select).
 */
@Component({
  selector: 'app-course-enrollment-form-modal',
  imports: [SharedModule, ReactiveFormsModule],
  templateUrl: './course-enrollment-form-modal.component.html',
  styleUrl: './course-enrollment-form-modal.component.scss'
})
export class CourseEnrollmentFormModalComponent implements OnChanges, OnDestroy {
  private readonly courseService = inject(CourseService);
  private readonly adminUserService = inject(AdminUserService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @Input() open = false;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly created = new EventEmitter<EnrollmentResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  courses: CourseSummary[] = [];
  coursesLoading = false;
  readonly courseControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  readonly studentSearchControl = new FormControl('', { nonNullable: true });
  studentResults: AdminUserResponse[] = [];
  studentSearching = false;
  studentResultsOpen = false;
  selectedStudent: AdminUserResponse | null = null;

  submitting = false;
  serverMessage = '';

  constructor() {
    this.iconService.addIcon(...[SearchOutline, CheckCircleOutline]);

    // Same pattern as TrainingEnrollmentFormModalComponent: any keystroke invalidates a previous
    // selection immediately, the debounced sibling below handles fetching results. Selecting a
    // result sets the control value with { emitEvent: false } so it doesn't re-trigger this and
    // clear the selection it just made.
    this.studentSearchControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.selectedStudent = null;
    });

    this.studentSearchControl.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => this.fetchStudentResults(term));
  }

  get canSubmit(): boolean {
    return !!this.courseControl.value && this.selectedStudent !== null && !this.submitting;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.courseControl.setValue('');
      this.studentSearchControl.setValue('', { emitEvent: false });
      this.selectedStudent = null;
      this.studentResults = [];
      this.studentResultsOpen = false;

      if (this.courses.length === 0) {
        this.loadCourses();
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

  onStudentInputFocus(): void {
    if (this.studentResults.length > 0) {
      this.studentResultsOpen = true;
    }
  }

  onStudentInputBlur(): void {
    setTimeout(() => {
      this.studentResultsOpen = false;
      this.cdr.markForCheck();
    }, 150);
  }

  selectStudent(student: AdminUserResponse): void {
    this.selectedStudent = student;
    this.studentSearchControl.setValue(`${student.firstName} ${student.lastName}`, { emitEvent: false });
    this.studentResultsOpen = false;
    this.studentResults = [];
  }

  submit(): void {
    if (!this.canSubmit) {
      return;
    }

    const courseId = this.courseControl.value;
    const student = this.selectedStudent as AdminUserResponse;

    this.serverMessage = '';
    this.submitting = true;

    this.enrollmentService
      .createEnrollment(student.id, courseId)
      .pipe(
        finalize(() => {
          this.submitting = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (enrollment) => this.created.emit(enrollment),
        error: (error) => this.handleCreateError(error)
      });
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

  private loadCourses(): void {
    this.coursesLoading = true;

    this.courseService
      .getAllCourseSummaries()
      .pipe(
        finalize(() => {
          this.coursesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (courses) => {
          this.courses = courses;
        },
        error: () => {
          // The course dropdown is the only way to submit this form — a load failure here is
          // surfaced by the dropdown simply staying empty, same fail-quiet treatment
          // TrainingEnrollmentFormModalComponent uses for the same kind of call.
        }
      });
  }

  private fetchStudentResults(term: string): void {
    const trimmed = term.trim();

    if (!trimmed) {
      this.studentResults = [];
      this.studentResultsOpen = false;
      return;
    }

    this.studentSearching = true;

    this.adminUserService
      .listStudents(0, SEARCH_RESULT_LIMIT, trimmed)
      .pipe(
        finalize(() => {
          this.studentSearching = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.studentResults = result.content;
          this.studentResultsOpen = true;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401 || status === 403) {
            return;
          }

          this.studentResults = [];
        }
      });
  }

  private handleCreateError(error: unknown): void {
    const httpError = error as { status?: number; error?: ApiErrorResponse };
    const status = httpError?.status;

    if (status === 401 || status === 403) {
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
        return this.translateService.instant('courses.enrollmentModal.checkStudentAndCourse');
      case 404:
        return this.translateService.instant('courses.enrollmentModal.studentOrCourseNotFound');
      case 409:
        return this.translateService.instant('courses.enrollmentModal.createConflict');
      case 503:
        return this.translateService.instant('courses.enrollmentModal.serviceUnavailable');
      default:
        return this.translateService.instant('courses.enrollmentModal.activateError');
    }
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
