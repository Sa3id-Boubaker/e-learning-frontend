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
import { TrainingEnrollmentResponse } from '../models/training-enrollment.models';
import { TrainingResponse } from '../models/training.models';
import { TrainingEnrollmentService } from '../training-enrollment.service';
import { TrainingService } from '../training.service';

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_RESULT_LIMIT = 5;

/**
 * "New enrollment" — a modal here rather than the inline form CourseEnrollmentManagement uses,
 * to match the other Training-side modals (TrainingPurchaseModalComponent,
 * CalendarEventModalComponent) instead of the one Course-side precedent.
 */
@Component({
  selector: 'app-training-enrollment-form-modal',
  imports: [SharedModule, ReactiveFormsModule],
  templateUrl: './training-enrollment-form-modal.component.html',
  styleUrl: './training-enrollment-form-modal.component.scss'
})
export class TrainingEnrollmentFormModalComponent implements OnChanges, OnDestroy {
  private readonly trainingService = inject(TrainingService);
  private readonly adminUserService = inject(AdminUserService);
  private readonly trainingEnrollmentService = inject(TrainingEnrollmentService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @Input() open = false;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly created = new EventEmitter<TrainingEnrollmentResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  trainings: TrainingResponse[] = [];
  trainingsLoading = false;
  readonly trainingControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  readonly studentSearchControl = new FormControl('', { nonNullable: true });
  studentResults: AdminUserResponse[] = [];
  studentSearching = false;
  studentResultsOpen = false;
  selectedStudent: AdminUserResponse | null = null;

  submitting = false;
  serverMessage = '';

  constructor() {
    this.iconService.addIcon(...[SearchOutline, CheckCircleOutline]);

    // Same pattern as EnrollmentManagementComponent: any keystroke invalidates a previous
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

  /** ADMIN sees every training via getAllTrainings() (including DRAFT/CANCELLED) — narrow to the states actually open for enrollment. */
  get eligibleTrainings(): TrainingResponse[] {
    return this.trainings.filter((training) => training.status === 'PUBLISHED' || training.status === 'IN_PROGRESS');
  }

  get canSubmit(): boolean {
    return !!this.trainingControl.value && this.selectedStudent !== null && !this.submitting;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.trainingControl.setValue('');
      this.studentSearchControl.setValue('', { emitEvent: false });
      this.selectedStudent = null;
      this.studentResults = [];
      this.studentResultsOpen = false;

      if (this.trainings.length === 0) {
        this.loadTrainings();
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

    const trainingId = this.trainingControl.value;
    const student = this.selectedStudent as AdminUserResponse;

    this.serverMessage = '';
    this.submitting = true;

    this.trainingEnrollmentService
      .createEnrollment(student.id, trainingId)
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
          // The training dropdown is the only way to submit this form — a load failure here is
          // surfaced by the dropdown simply staying empty, same fail-quiet treatment the
          // calendar's training filter uses for the same underlying call.
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
        return this.translateService.instant('trainings.enrollmentModal.notAStudent');
      case 404:
        return this.translateService.instant('trainings.enrollmentModal.studentOrTrainingNotFound');
      case 409:
        return this.translateService.instant('trainings.enrollmentModal.notOpenForEnrollment');
      case 503:
        return this.translateService.instant('trainings.enrollmentModal.serviceUnavailable');
      default:
        return this.translateService.instant('trainings.enrollmentModal.createError');
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
