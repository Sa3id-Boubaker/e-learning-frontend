import { CommonModule } from '@angular/common';
import { HttpEvent, HttpEventType } from '@angular/common/http';
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

import { IconService } from '@ant-design/icons-angular';
import { InboxOutline, PlayCircleOutline } from '@ant-design/icons-angular/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { formatDuration } from '../format-duration';
import { VideoCreateRequest, VideoResponse, VideoUpdateRequest } from '../models/video.models';
import { validateVideoFile } from '../video-file-validation';
import { VideoService } from '../video.service';

export type VideoFormModalMode = 'create' | 'edit';
type VideoFormFieldName = 'title' | 'description' | 'order';

@Component({
  selector: 'app-video-form-modal',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './video-form-modal.component.html',
  styleUrl: './video-form-modal.component.scss'
})
export class VideoFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly videoService = inject(VideoService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() mode: VideoFormModalMode = 'create';
  @Input() video: VideoResponse | null = null;
  @Input() chapterId = '';
  @Input() nextOrder = 1;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<VideoResponse>();
  /** Emitted on 403/404 — the chapter or video changed elsewhere; parent should close and resync. */
  @Output() readonly conflict = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    order: [1, [Validators.required, Validators.min(1)]]
  });

  readonly formatDuration = formatDuration;

  saving = false;
  uploadProgress = 0;
  serverMessage = '';
  fieldMessages: Record<string, string> = {};

  selectedFile: File | null = null;
  fileError = '';
  dragOver = false;

  constructor() {
    this.iconService.addIcon(...[InboxOutline, PlayCircleOutline]);
  }

  get hasChanges(): boolean {
    return this.mode === 'create' || !this.form.pristine;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.fieldMessages = {};
      this.fileError = '';
      this.dragOver = false;
      this.selectedFile = null;
      this.uploadProgress = 0;

      if (this.mode === 'create') {
        this.form.reset({
          title: '',
          description: '',
          order: this.nextOrder
        });
      } else if (this.mode === 'edit' && this.video) {
        this.form.reset({
          title: this.video.title,
          description: this.video.description ?? '',
          order: this.video.order
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

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();

    if (!this.saving) {
      this.dragOver = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;

    if (this.saving) {
      return;
    }

    const file = event.dataTransfer?.files?.[0];
    this.handleFile(file);
  }

  controlInvalid(name: VideoFormFieldName): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(name: VideoFormFieldName): string {
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

  private handleFile(file: File | undefined | null): void {
    if (!file) {
      return;
    }

    this.fileError = '';
    const validationError = validateVideoFile(file);

    if (validationError) {
      this.fileError = validationError;
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
  }

  private submitCreate(): void {
    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.selectedFile) {
      this.fileError = this.fileError || this.translateService.instant('courses.videoFormModal.selectFile');
      return;
    }

    this.saving = true;
    this.uploadProgress = 0;
    const { title, description, order } = this.form.getRawValue();
    const trimmedDescription = description.trim();

    const payload: VideoCreateRequest = {
      title,
      order,
      file: this.selectedFile,
      ...(trimmedDescription ? { description: trimmedDescription } : {})
    };

    this.videoService.createVideo(this.chapterId, payload).subscribe({
      next: (event) => this.handleUploadEvent(event),
      error: (error) => {
        this.saving = false;
        this.uploadProgress = 0;
        this.cdr.markForCheck();
        this.handleSaveError(error);
      }
    });
  }

  private handleUploadEvent(event: HttpEvent<VideoResponse>): void {
    if (event.type === HttpEventType.UploadProgress) {
      if (event.total) {
        this.uploadProgress = Math.round((event.loaded / event.total) * 100);
        this.cdr.markForCheck();
      }
      return;
    }

    if (event.type === HttpEventType.Response) {
      this.saving = false;
      this.uploadProgress = 100;
      this.cdr.markForCheck();

      if (event.body) {
        this.toastService.success(this.translateService.instant('courses.videoFormModal.videoAdded'));
        this.saved.emit(event.body);
      }
    }
  }

  private submitEdit(): void {
    if (!this.video || !this.hasChanges) {
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
    const payload: VideoUpdateRequest = { title, description, order };

    this.videoService.updateVideo(this.video.id, payload).subscribe({
      next: (video) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.videoFormModal.videoUpdated'));
        this.saved.emit(video);
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
      this.toastService.error(apiError?.message ?? this.translateService.instant('courses.videoFormModal.conflictError'));
      this.conflict.emit();
      return;
    }

    const message = apiError?.message ?? this.translateService.instant('courses.videoFormModal.saveError');
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
