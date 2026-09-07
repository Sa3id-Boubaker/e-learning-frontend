import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { QuizCreateRequest, QuizResponse, QuizUpdateRequest } from '../models/quiz.models';
import { QuizService } from '../quiz.service';

export type QuizFormModalMode = 'create' | 'edit';
type QuizFormFieldName = 'title' | 'description' | 'passingScore';

@Component({
  selector: 'app-quiz-form-modal',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './quiz-form-modal.component.html',
  styleUrl: './quiz-form-modal.component.scss'
})
export class QuizFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly quizService = inject(QuizService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() mode: QuizFormModalMode = 'create';
  @Input() quiz: QuizResponse | null = null;
  @Input() courseId = '';

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<QuizResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    passingScore: [70, [Validators.required, Validators.min(0), Validators.max(100)]]
  });

  saving = false;
  serverMessage = '';
  fieldMessages: Record<string, string> = {};

  get hasChanges(): boolean {
    return this.mode === 'create' || !this.form.pristine;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.fieldMessages = {};

      if (this.mode === 'create') {
        this.form.reset({ title: '', description: '', passingScore: 70 });
      } else if (this.mode === 'edit' && this.quiz) {
        this.form.reset({
          title: this.quiz.title,
          description: this.quiz.description ?? '',
          passingScore: this.quiz.passingScore
        });
      }

      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  submit(): void {
    if (this.saving) {
      return;
    }

    if (this.mode === 'create') {
      this.submitCreate();
    } else {
      this.submitEdit();
    }
  }

  onCancel(): void {
    if (this.saving) {
      return;
    }

    this.closed.emit();
  }

  controlInvalid(name: QuizFormFieldName): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(name: QuizFormFieldName): string {
    if (this.fieldMessages[name]) {
      return this.fieldMessages[name];
    }

    const control = this.form.controls[name];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (name === 'passingScore' && (control.hasError('min') || control.hasError('max'))) {
      return this.translateService.instant('courses.quizFormModal.passingScoreRange');
    }

    return '';
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

  private submitCreate(): void {
    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const { title, description, passingScore } = this.form.getRawValue();
    const trimmedDescription = description.trim();

    const payload: QuizCreateRequest = {
      title,
      passingScore,
      ...(trimmedDescription ? { description: trimmedDescription } : {})
    };

    this.quizService.createQuiz(this.courseId, payload).subscribe({
      next: (quiz) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.quizFormModal.quizCreated'));
        this.saved.emit(quiz);
      },
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.handleSaveError(error);
      }
    });
  }

  private submitEdit(): void {
    if (!this.quiz || !this.hasChanges) {
      return;
    }

    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const { title, description, passingScore } = this.form.getRawValue();
    const payload: QuizUpdateRequest = { title, description, passingScore };

    this.quizService.updateQuiz(this.courseId, payload).subscribe({
      next: (quiz) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.quizFormModal.quizUpdated'));
        this.saved.emit(quiz);
      },
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.handleSaveError(error);
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

    if (status === 400 && apiError?.errors) {
      this.fieldMessages = apiError.errors;
      this.toastService.error(apiError.message ?? this.translateService.instant('courses.formModal.correctFields'));
      return;
    }

    if (status === 409) {
      this.toastService.error(apiError?.message ?? this.translateService.instant('courses.quizFormModal.alreadyExists'));
      this.closed.emit();
      return;
    }

    const message = apiError?.message ?? this.translateService.instant('courses.quizFormModal.saveError');
    this.serverMessage = message;
    this.toastService.error(message);
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
