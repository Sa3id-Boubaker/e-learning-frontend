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
import { ChapterService } from '../chapter.service';
import { ChapterCreateRequest, ChapterResponse, ChapterUpdateRequest } from '../models/chapter.models';

export type ChapterFormModalMode = 'create' | 'edit';
type ChapterFormFieldName = 'title' | 'description' | 'order';

@Component({
  selector: 'app-chapter-form-modal',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './chapter-form-modal.component.html',
  styleUrl: './chapter-form-modal.component.scss'
})
export class ChapterFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly chapterService = inject(ChapterService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() mode: ChapterFormModalMode = 'create';
  @Input() chapter: ChapterResponse | null = null;
  @Input() courseId = '';
  @Input() nextOrder = 1;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<ChapterResponse>();
  /** Emitted on 403/404 — the course or chapter changed elsewhere; parent should close and resync. */
  @Output() readonly conflict = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    order: [1, [Validators.required, Validators.min(1)]]
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
        this.form.reset({
          title: '',
          description: '',
          order: this.nextOrder
        });
      } else if (this.mode === 'edit' && this.chapter) {
        this.form.reset({
          title: this.chapter.title,
          description: this.chapter.description ?? '',
          order: this.chapter.order
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

  controlInvalid(name: ChapterFormFieldName): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(name: ChapterFormFieldName): string {
    if (this.fieldMessages[name]) {
      return this.fieldMessages[name];
    }

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

  private submitCreate(): void {
    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const { title, description, order } = this.form.getRawValue();
    const trimmedDescription = description.trim();

    const payload: ChapterCreateRequest = {
      title,
      order,
      ...(trimmedDescription ? { description: trimmedDescription } : {})
    };

    this.chapterService.createChapter(this.courseId, payload).subscribe({
      next: (chapter) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.chapterFormModal.chapterAdded'));
        this.saved.emit(chapter);
      },
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.handleSaveError(error);
      }
    });
  }

  private submitEdit(): void {
    if (!this.chapter || !this.hasChanges) {
      return;
    }

    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const { title, description, order } = this.form.getRawValue();
    const payload: ChapterUpdateRequest = { title, description, order };

    this.chapterService.updateChapter(this.chapter.id, payload).subscribe({
      next: (chapter) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.chapterFormModal.chapterUpdated'));
        this.saved.emit(chapter);
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

    if (status === 403 || status === 404) {
      this.toastService.error(apiError?.message ?? this.translateService.instant('courses.chapterFormModal.conflictError'));
      this.conflict.emit();
      return;
    }

    const message = apiError?.message ?? this.translateService.instant('courses.chapterFormModal.saveError');
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
