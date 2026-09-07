import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { RecordingResponse, RecordingUpdateRequest } from '../models/recording.models';
import { RecordingService } from '../recording.service';

type RecordingMetadataFieldName = 'title' | 'description';

@Component({
  selector: 'app-recording-metadata-form',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './recording-metadata-form.component.html',
  styleUrl: './recording-metadata-form.component.scss'
})
export class RecordingMetadataFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly recordingService = inject(RecordingService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() recording: RecordingResponse | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<RecordingResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: ['']
  });

  saving = false;
  serverMessage = '';
  fieldMessages: Record<string, string> = {};

  get hasChanges(): boolean {
    return !this.form.pristine;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.fieldMessages = {};

      if (this.recording) {
        this.form.reset({
          title: this.recording.title,
          description: this.recording.description ?? ''
        });
      }

      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  onCancel(): void {
    if (this.saving) {
      return;
    }

    this.closed.emit();
  }

  controlInvalid(name: RecordingMetadataFieldName): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(name: RecordingMetadataFieldName): string {
    if (this.fieldMessages[name]) {
      return this.fieldMessages[name];
    }

    const control = this.form.controls[name];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    return '';
  }

  submit(): void {
    if (this.saving || !this.recording || !this.hasChanges) {
      return;
    }

    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const { title, description } = this.form.getRawValue();
    const payload: RecordingUpdateRequest = { title, description };

    this.recordingService.updateMetadata(this.recording.id, payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('trainings.recordingMetadataForm.recordingUpdated'));
        this.saved.emit(updated);
      },
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.handleSaveError(error);
      }
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

    const message = apiError?.message ?? this.translateService.instant('trainings.recordingMetadataForm.saveError');
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
