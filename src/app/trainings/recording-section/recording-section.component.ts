import { HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';

import { IconService } from '@ant-design/icons-angular';
import { DeleteOutline, EditOutline, InboxOutline, UploadOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { formatRecordingDuration } from '../format-recording-duration';
import { LiveSessionResponse } from '../models/live-session.models';
import { RecordingResponse } from '../models/recording.models';
import { RecordingMetadataFormComponent } from '../recording-metadata-form/recording-metadata-form.component';
import { validateRecordingFile } from '../recording-file-validation';
import { RecordingService } from '../recording.service';

type UploadMode = 'create' | 'replace';

@Component({
  selector: 'app-recording-section',
  imports: [SharedModule, DeleteConfirmationModalComponent, RecordingMetadataFormComponent],
  templateUrl: './recording-section.component.html',
  styleUrl: './recording-section.component.scss'
})
export class RecordingSectionComponent implements OnChanges {
  private readonly recordingService = inject(RecordingService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input({ required: true }) session!: LiveSessionResponse;
  @Input() canManage = false;

  // Lets the parent's Recordings tab know, once the initial check settles, whether this session
  // ended up with anything to show (a recording, an upload prompt, or an error to retry) — used
  // only to decide the tab's empty state; this component's own template still self-hides.
  @Output() readonly resolved = new EventEmitter<boolean>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  recording: RecordingResponse | null = null;
  checked = false;
  loading = false;
  loadError = '';

  uploading = false;
  uploadProgress = 0;
  fileError = '';
  serverMessage = '';
  private uploadMode: UploadMode = 'create';

  metadataModalOpen = false;

  deleteModalOpen = false;
  deleteLoading = false;

  readonly formatRecordingDuration = formatRecordingDuration;

  constructor() {
    this.iconService.addIcon(...[UploadOutline, InboxOutline, EditOutline, DeleteOutline]);
  }

  get isCompleted(): boolean {
    return this.session.status === 'COMPLETED';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.isCompleted && !this.checked && !this.loading) {
      this.loadRecording();
    }
  }

  loadRecording(): void {
    this.loading = true;
    this.loadError = '';

    this.recordingService.getBySession(this.session.id).subscribe({
      next: (recording) => {
        this.loading = false;
        this.checked = true;
        this.recording = recording;
        this.cdr.markForCheck();
        this.emitResolved();
      },
      error: (error) => {
        this.loading = false;
        this.checked = true;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        if (status === 404) {
          this.recording = null;
          this.emitResolved();
          return;
        }

        // Defensive — the Recordings tab that hosts this component is already behind
        // TrainingDetailComponent's enrollment gate, so a 403 shouldn't normally reach here, but
        // keep the message correct in case that gating ever changes.
        if (status === 403) {
          this.loadError = this.translateService.instant('trainings.recordingSection.enrollToWatch');
          this.emitResolved();
          return;
        }

        this.loadError = this.translateService.instant('trainings.recordingSection.loadError');
        this.emitResolved();
      }
    });
  }

  /** hasContent mirrors this component's own template condition for showing anything at all. */
  private emitResolved(): void {
    this.resolved.emit(!!this.recording || this.canManage || !!this.loadError);
  }

  openUploadPicker(): void {
    this.uploadMode = 'create';
    this.fileInput?.nativeElement.click();
  }

  openReplacePicker(): void {
    this.uploadMode = 'replace';
    this.fileInput?.nativeElement.click();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    this.fileError = '';
    this.serverMessage = '';
    const validationError = validateRecordingFile(file);

    if (validationError) {
      this.fileError = validationError;
      return;
    }

    this.uploading = true;
    this.uploadProgress = 0;

    const upload$ =
      this.uploadMode === 'replace' && this.recording
        ? this.recordingService.replaceVideo(this.recording.id, file)
        : this.recordingService.create(this.session.id, file);

    upload$.subscribe({
      next: (event) => this.handleUploadEvent(event),
      error: (error) => this.handleUploadError(error)
    });
  }

  openMetadataModal(): void {
    this.metadataModalOpen = true;
  }

  onMetadataModalClosed(): void {
    this.metadataModalOpen = false;
  }

  onMetadataSaved(updated: RecordingResponse): void {
    this.recording = updated;
    this.metadataModalOpen = false;
    this.cdr.markForCheck();
  }

  openDeleteModal(): void {
    this.deleteModalOpen = true;
  }

  onDeleteModalClosed(): void {
    if (this.deleteLoading) {
      return;
    }

    this.deleteModalOpen = false;
  }

  confirmDelete(): void {
    if (!this.recording || this.deleteLoading) {
      return;
    }

    this.deleteLoading = true;
    const recordingId = this.recording.id;

    this.recordingService.delete(recordingId).subscribe({
      next: () => {
        this.deleteLoading = false;
        this.deleteModalOpen = false;
        this.recording = null;
        this.toastService.success(this.translateService.instant('trainings.recordingSection.recordingDeleted'));
        this.cdr.markForCheck();
        this.emitResolved();
      },
      error: (error) => {
        this.deleteLoading = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('trainings.recordingSection.deleteError'));
      }
    });
  }

  private handleUploadEvent(event: HttpEvent<RecordingResponse>): void {
    if (event.type === HttpEventType.UploadProgress) {
      if (event.total) {
        this.uploadProgress = Math.round((event.loaded / event.total) * 100);
        this.cdr.markForCheck();
      }
      return;
    }

    if (event.type === HttpEventType.Response) {
      this.uploading = false;
      this.uploadProgress = 100;
      this.cdr.markForCheck();

      if (event.body) {
        this.recording = event.body;
        this.toastService.success(
          this.translateService.instant(
            this.uploadMode === 'replace' ? 'trainings.recordingSection.videoReplaced' : 'trainings.recordingSection.recordingUploaded'
          )
        );
        this.emitResolved();
      }
    }
  }

  private handleUploadError(error: unknown): void {
    this.uploading = false;
    this.uploadProgress = 0;
    this.cdr.markForCheck();

    const httpError = error as HttpErrorResponse;
    const status = httpError?.status;

    if (status === 401) {
      return;
    }

    const apiError = httpError?.error as ApiErrorResponse | undefined;
    const message = apiError?.message ?? this.translateService.instant('trainings.recordingSection.uploadError');
    this.serverMessage = message;
    this.toastService.error(message);

    // A 409 ("already exists") most likely means another user just uploaded one — resync so the
    // player shows instead of leaving the upload button stuck pointing at a stale state.
    if (status === 409) {
      this.loadRecording();
    }
  }
}
