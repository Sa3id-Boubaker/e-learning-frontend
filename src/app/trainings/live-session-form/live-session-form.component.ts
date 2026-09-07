import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { LiveSessionService } from '../live-session.service';
import { getLiveSessionStatusBadgeClass, getLiveSessionStatusLabel } from '../live-session-status';
import { LiveSessionCreateRequest, LiveSessionResponse, LiveSessionUpdateRequest } from '../models/live-session.models';
import { canManageTraining } from '../training-permissions';
import { TrainingResponse } from '../models/training.models';
import { TrainingService } from '../training.service';

export type LiveSessionFormMode = 'create' | 'edit';
type LiveSessionFormFieldName = 'title' | 'description' | 'startAt' | 'endAt' | 'meetingUrl' | 'status';

function dateTimeRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startAt')?.value as string | undefined;
  const end = group.get('endAt')?.value as string | undefined;

  if (start && end && end <= start) {
    return { dateRange: true };
  }

  return null;
}

const urlValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string;

  if (!value) {
    return null;
  }

  try {
    new URL(value);
    return null;
  } catch {
    return { url: true };
  }
};

/**
 * The backend's startAt/endAt are naive "YYYY-MM-DDTHH:mm:ss" strings (no timezone suffix) that
 * already hold the correct wall-clock time — going through `new Date(...)` here would parse them
 * in the browser's local timezone, which silently shifts the value whenever that timezone isn't
 * the one the string was written in. Slicing the string keeps it a straight pass-through.
 */
function toDatetimeLocalValue(naiveDateTime: string): string {
  return naiveDateTime.slice(0, 16);
}

/** The reverse of toDatetimeLocalValue: an <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm") -> the naive "YYYY-MM-DDTHH:mm:ss" string the backend expects. No Date object, no timezone math. */
function fromDatetimeLocalValue(value: string): string {
  return `${value}:00`;
}

@Component({
  selector: 'app-live-session-form',
  imports: [SharedModule, ReactiveFormsModule, RouterLink],
  templateUrl: './live-session-form.component.html',
  styleUrl: './live-session-form.component.scss'
})
export class LiveSessionFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly liveSessionService = inject(LiveSessionService);
  private readonly trainingService = inject(TrainingService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  mode: LiveSessionFormMode = 'create';
  private trainingId = '';
  private sessionId = '';
  training: TrainingResponse | null = null;
  session: LiveSessionResponse | null = null;

  // Fetching the parent training first (both modes need it — for ownership gating and page
  // context), then, in edit mode, the session itself before the form can render.
  loading = false;
  notFound = false;
  accessDenied = false;
  loadError = '';

  // currentUser$ can still be null the instant this component initializes on a hard refresh —
  // same rationale as elsewhere in this app. canAccessForm re-derives from currentUser + the
  // loaded training, so a late-arriving role never gets stuck.
  private currentUser: UserProfileResponse | null = null;
  accessChecked = false;

  readonly form = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required]],
      description: ['', [Validators.required]],
      startAt: ['', [Validators.required]],
      endAt: ['', [Validators.required]],
      meetingUrl: ['', [urlValidator]],
      status: ['SCHEDULED' as LiveSessionResponse['status'], [Validators.required]]
    },
    { validators: dateTimeRangeValidator }
  );

  saving = false;
  serverMessage = '';
  fieldMessages: Record<string, string> = {};

  readonly getLiveSessionStatusLabel = getLiveSessionStatusLabel;
  readonly getLiveSessionStatusBadgeClass = getLiveSessionStatusBadgeClass;

  get pageTitle(): string {
    return this.translateService.instant(this.mode === 'create' ? 'trainings.liveSessionForm.addTitle' : 'trainings.liveSessionForm.editTitle');
  }

  get hasChanges(): boolean {
    return this.mode === 'create' || !this.form.pristine;
  }

  get canAccessForm(): boolean {
    if (!this.currentUser || !this.training) {
      return false;
    }

    if (this.currentUser.role === 'ETUDIANT') {
      return false;
    }

    return canManageTraining(this.training, this.currentUser);
  }

  get backUrl(): string {
    return `/trainings/${this.trainingId}`;
  }

  get dateRangeInvalid(): boolean {
    return this.form.hasError('dateRange') && (this.form.controls.endAt.touched || this.form.controls.endAt.dirty);
  }

  ngOnInit(): void {
    this.trainingId = this.route.snapshot.paramMap.get('trainingId') ?? '';
    const sessionIdParam = this.route.snapshot.paramMap.get('id');
    this.mode = sessionIdParam ? 'edit' : 'create';
    this.sessionId = sessionIdParam ?? '';

    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.accessChecked = true;
      this.cdr.markForCheck();
    });

    this.loadTraining();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTraining(): void {
    if (!this.trainingId) {
      this.notFound = true;
      return;
    }

    this.loading = true;
    this.notFound = false;
    this.accessDenied = false;
    this.loadError = '';

    this.trainingService.getTrainingById(this.trainingId).subscribe({
      next: (training) => {
        this.training = training;

        if (this.mode === 'edit') {
          this.loadSession();
        } else {
          this.loading = false;
        }

        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        if (status === 404) {
          this.notFound = true;
          return;
        }

        if (status === 403) {
          this.accessDenied = true;
          return;
        }

        this.loadError = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('trainings.detail.loadError');
      }
    });
  }

  loadSession(): void {
    if (!this.sessionId) {
      this.loading = false;
      this.notFound = true;
      return;
    }

    this.liveSessionService.getById(this.sessionId).subscribe({
      next: (session) => {
        this.loading = false;
        this.session = session;
        this.form.reset({
          title: session.title,
          description: session.description,
          startAt: toDatetimeLocalValue(session.startAt),
          endAt: toDatetimeLocalValue(session.endAt),
          meetingUrl: session.meetingUrl ?? '',
          status: session.status
        });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        if (status === 404) {
          this.notFound = true;
          return;
        }

        if (status === 403) {
          this.accessDenied = true;
          return;
        }

        this.loadError = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('trainings.liveSessionForm.loadSessionError');
      }
    });
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

  /** SCHEDULED/LIVE/COMPLETED are computed server-side from startAt/endAt — CANCELLED is the only manual status left. */
  cancelSession(): void {
    this.form.controls.status.setValue('CANCELLED');
    this.form.controls.status.markAsDirty();
  }

  /** Hands the session back to automatic status computation — SCHEDULED is recomputed immediately if the dates warrant it. */
  reactivateSession(): void {
    this.form.controls.status.setValue('SCHEDULED');
    this.form.controls.status.markAsDirty();
  }

  controlInvalid(name: LiveSessionFormFieldName): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(name: LiveSessionFormFieldName): string {
    if (this.fieldMessages[name]) {
      return this.fieldMessages[name];
    }

    const control = this.form.controls[name];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (name === 'meetingUrl' && control.hasError('url')) {
      return this.translateService.instant('trainings.liveSessionForm.invalidUrl');
    }

    return '';
  }

  private submitCreate(): void {
    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const { title, description, startAt, endAt, meetingUrl, status } = this.form.getRawValue();

    const payload: LiveSessionCreateRequest = {
      title,
      description,
      startAt: fromDatetimeLocalValue(startAt),
      endAt: fromDatetimeLocalValue(endAt),
      meetingUrl: meetingUrl || undefined,
      status
    };

    this.liveSessionService.create(this.trainingId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('trainings.liveSessionForm.sessionCreated'));
        void this.router.navigateByUrl(this.backUrl);
      },
      error: (error) => this.handleSaveError(error)
    });
  }

  private submitEdit(): void {
    if (!this.session || !this.hasChanges) {
      return;
    }

    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildUpdatePayload(this.session);

    if (Object.keys(payload).length === 0) {
      return;
    }

    this.saving = true;

    this.liveSessionService.update(this.session.id, payload).subscribe({
      next: () => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('trainings.liveSessionForm.sessionUpdated'));
        void this.router.navigateByUrl(this.backUrl);
      },
      error: (error) => this.handleSaveError(error)
    });
  }

  /** Only sends fields that actually changed from the record this form was loaded with. */
  private buildUpdatePayload(original: LiveSessionResponse): LiveSessionUpdateRequest {
    const raw = this.form.getRawValue();
    const payload: LiveSessionUpdateRequest = {};

    if (raw.title !== original.title) {
      payload.title = raw.title;
    }

    if (raw.description !== original.description) {
      payload.description = raw.description;
    }

    const startAtIso = fromDatetimeLocalValue(raw.startAt);
    if (startAtIso !== original.startAt) {
      payload.startAt = startAtIso;
    }

    const endAtIso = fromDatetimeLocalValue(raw.endAt);
    if (endAtIso !== original.endAt) {
      payload.endAt = endAtIso;
    }

    if (raw.meetingUrl !== (original.meetingUrl ?? '')) {
      payload.meetingUrl = raw.meetingUrl;
    }

    if (raw.status !== original.status) {
      payload.status = raw.status;
    }

    return payload;
  }

  private handleSaveError(error: unknown): void {
    this.saving = false;
    this.cdr.markForCheck();

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

    // Covers both the plain-message 400 ("End date/time must be after start date/time") and the
    // 409 conflict ("Another session already exists during this time period.") — neither comes
    // with a field-level `errors` map, so both surface the same way: form-level alert + toast.
    const message = apiError?.message ?? this.translateService.instant('trainings.liveSessionForm.saveError');
    this.serverMessage = message;
    this.toastService.error(message);
  }
}
