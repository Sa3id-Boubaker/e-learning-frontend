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
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

import { IconService } from '@ant-design/icons-angular';
import { DeleteOutline, PlusOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { OptionRequest, QuestionCreateRequest, QuestionResponse, QuestionUpdateRequest } from '../models/quiz.models';
import { QuizService } from '../quiz.service';

export type QuestionFormModalMode = 'create' | 'edit';

type OptionFormGroup = FormGroup<{
  text: FormControl<string>;
  correct: FormControl<boolean>;
}>;

interface OptionFormValue {
  text: string;
  correct: boolean;
}

@Component({
  selector: 'app-question-form-modal',
  imports: [SharedModule],
  templateUrl: './question-form-modal.component.html',
  styleUrl: './question-form-modal.component.scss'
})
export class QuestionFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly quizService = inject(QuizService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() mode: QuestionFormModalMode = 'create';
  @Input() question: QuestionResponse | null = null;
  @Input() quizId = '';
  @Input() nextOrder = 1;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<QuestionResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    questionText: ['', [Validators.required]],
    order: [1, [Validators.required, Validators.min(1)]],
    options: this.fb.array<OptionFormGroup>([])
  });

  saving = false;
  serverMessage = '';

  constructor() {
    this.iconService.addIcon(...[DeleteOutline, PlusOutline]);
  }

  get optionsArray() {
    return this.form.controls.options;
  }

  get isFormValid(): boolean {
    if (this.form.controls.questionText.invalid || this.form.controls.order.invalid) {
      return false;
    }

    return this.optionsHint === '';
  }

  get optionsHint(): string {
    const options = this.optionsArray.getRawValue() as OptionFormValue[];
    const nonEmptyOptions = options.filter((option) => option.text.trim().length > 0);

    if (nonEmptyOptions.length < 2) {
      return this.translateService.instant('courses.questionFormModal.needAtLeastTwoOptions');
    }

    if (!nonEmptyOptions.some((option) => option.correct)) {
      return this.translateService.instant('courses.questionFormModal.needOneCorrectOption');
    }

    return '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.optionsArray.clear();

      if (this.mode === 'create') {
        this.form.reset({ questionText: '', order: this.nextOrder });
        this.addOption();
        this.addOption();
      } else if (this.mode === 'edit' && this.question) {
        this.form.reset({ questionText: this.question.questionText, order: this.question.order });
        this.question.options.forEach((option) => this.addOption(option.text, option.correct ?? false));
      }

      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  addOption(text = '', correct = false): void {
    this.optionsArray.push(this.createOptionGroup(text, correct));
  }

  removeOption(index: number): void {
    if (this.optionsArray.length <= 2) {
      return;
    }

    this.optionsArray.removeAt(index);
  }

  submit(): void {
    if (this.saving || !this.isFormValid) {
      return;
    }

    this.serverMessage = '';

    if (this.form.controls.questionText.invalid || this.form.controls.order.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const options = this.optionsArray.getRawValue() as OptionFormValue[];
    const payloadOptions: OptionRequest[] = options
      .filter((option) => option.text.trim().length > 0)
      .map((option) => ({ text: option.text.trim(), correct: option.correct }));

    if (this.mode === 'create') {
      this.submitCreate(payloadOptions);
    } else {
      this.submitEdit(payloadOptions);
    }
  }

  onCancel(): void {
    if (this.saving) {
      return;
    }

    this.closed.emit();
  }

  controlInvalid(name: 'questionText' | 'order'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(name: 'questionText' | 'order'): string {
    const control = this.form.controls[name];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (name === 'order' && control.hasError('min')) {
      return this.translateService.instant('courses.chapterFormModal.orderMin');
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

  private createOptionGroup(text = '', correct = false): OptionFormGroup {
    return this.fb.nonNullable.group({
      text: [text],
      correct: [correct]
    });
  }

  private submitCreate(options: OptionRequest[]): void {
    this.saving = true;
    const { questionText, order } = this.form.getRawValue();

    const payload: QuestionCreateRequest = { questionText, order, options };

    this.quizService.createQuestion(this.quizId, payload).subscribe({
      next: (question) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.questionFormModal.questionAdded'));
        this.saved.emit(question);
      },
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.handleSaveError(error);
      }
    });
  }

  private submitEdit(options: OptionRequest[]): void {
    if (!this.question) {
      return;
    }

    this.saving = true;
    const { questionText, order } = this.form.getRawValue();

    const payload: QuestionUpdateRequest = { questionText, order, options };

    this.quizService.updateQuestion(this.quizId, this.question.id, payload).subscribe({
      next: (question) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.questionFormModal.questionUpdated'));
        this.saved.emit(question);
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
    const message = apiError?.message ?? this.translateService.instant('courses.questionFormModal.saveError');
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
