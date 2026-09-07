import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { InboxOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AdminUserService } from '../../admin/admin-user.service';
import { AdminUserResponse } from '../../admin/models/admin-user.models';
import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { validateAvatarFile as validateImageFile } from '../../profile/avatar-file-validation';
import { canManageTraining } from '../training-permissions';
import { getTrainingStatusBadgeClass, getTrainingStatusLabel } from '../training-status';
import { TrainingCreateRequest, TrainingResponse, TrainingStatus, TrainingUpdateRequest } from '../models/training.models';
import { TrainingService } from '../training.service';

export type TrainingFormMode = 'create' | 'edit';
type TrainingFormFieldName = 'title' | 'description' | 'price' | 'discountPercentage' | 'startDate' | 'endDate' | 'status';

/** Formateurs are few enough in practice that a single page covers "all of them" for a plain dropdown. */
const INSTRUCTOR_LIST_PAGE_SIZE = 100;

function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as string | undefined;
  const end = group.get('endDate')?.value as string | undefined;

  if (start && end && end < start) {
    return { dateRange: true };
  }

  return null;
}

@Component({
  selector: 'app-training-form',
  imports: [SharedModule, ReactiveFormsModule, RouterLink],
  templateUrl: './training-form.component.html',
  styleUrl: './training-form.component.scss'
})
export class TrainingFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly trainingService = inject(TrainingService);
  private readonly adminUserService = inject(AdminUserService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  mode: TrainingFormMode = 'create';
  private trainingId = '';
  training: TrainingResponse | null = null;

  // Edit mode only — fetching the existing record before the form can render.
  loading = false;
  notFound = false;
  accessDenied = false;
  loadError = '';

  // currentUser$ can still be null the instant this component initializes on a hard refresh —
  // same rationale as elsewhere in this app. canAccessForm re-derives from both currentUser and
  // (in edit mode) the loaded training, so a late-arriving role/training never gets stuck.
  private currentUser: UserProfileResponse | null = null;
  accessChecked = false;

  readonly form = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required]],
      description: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      discountPercentage: [0, [Validators.min(0), Validators.max(100)]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      status: ['DRAFT' as TrainingResponse['status'], [Validators.required]]
    },
    { validators: dateRangeValidator }
  );

  saving = false;
  serverMessage = '';
  fieldMessages: Record<string, string> = {};

  stagedFile: File | null = null;
  imagePreviewUrl: string | null = null;
  imageError = '';
  dragOver = false;

  readonly instructorControl = new FormControl('', { nonNullable: true });
  trainers: AdminUserResponse[] = [];
  trainersLoading = false;
  instructorError = '';

  readonly getTrainingStatusLabel = getTrainingStatusLabel;
  readonly getTrainingStatusBadgeClass = getTrainingStatusBadgeClass;

  /** Create-time only — a new training can start as either DRAFT or PUBLISHED; IN_PROGRESS/COMPLETED/CANCELLED are never valid at creation. */
  readonly createStatusOptions: TrainingStatus[] = ['DRAFT', 'PUBLISHED'];

  constructor() {
    this.iconService.addIcon(...[InboxOutline]);
  }

  get pageTitle(): string {
    return this.translateService.instant(this.mode === 'create' ? 'trainings.form.createTitle' : 'trainings.form.editTitle');
  }

  get hasChanges(): boolean {
    return this.mode === 'create' || !this.form.pristine || !!this.instructorControl.value;
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  get instructorRequired(): boolean {
    return this.mode === 'create' && this.isAdmin;
  }

  get canAccessForm(): boolean {
    if (!this.currentUser) {
      return false;
    }

    if (this.mode === 'create') {
      return this.currentUser.role === 'ADMIN' || this.currentUser.role === 'FORMATEUR';
    }

    return !!this.training && canManageTraining(this.training, this.currentUser);
  }

  get backUrl(): string {
    return this.mode === 'edit' && this.trainingId ? `/trainings/${this.trainingId}` : '/trainings';
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.mode = idParam ? 'edit' : 'create';
    this.trainingId = idParam ?? '';

    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.accessChecked = true;
      this.cdr.markForCheck();

      if (this.isAdmin && this.trainers.length === 0) {
        this.loadTrainers();
      }
    });

    if (this.mode === 'edit') {
      this.loadTraining();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.revokeStagedPreview();
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

    this.trainingService
      .getTrainingById(this.trainingId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (training) => {
          this.training = training;
          this.form.reset({
            title: training.title,
            description: training.description,
            price: training.price,
            discountPercentage: training.discountPercentage,
            startDate: training.startDate,
            endDate: training.endDate,
            status: training.status
          });
        },
        error: (error) => {
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

  /** DRAFT -> PUBLISHED is still a manual decision; IN_PROGRESS/COMPLETED are computed server-side from startDate/endDate. */
  publishTraining(): void {
    this.form.controls.status.setValue('PUBLISHED');
    this.form.controls.status.markAsDirty();
  }

  /** CANCELLED is the only other manual status, available from any non-DRAFT, non-CANCELLED state. */
  cancelTraining(): void {
    this.form.controls.status.setValue('CANCELLED');
    this.form.controls.status.markAsDirty();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    this.handleFile(file);
  }

  controlInvalid(name: TrainingFormFieldName): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(name: TrainingFormFieldName): string {
    if (this.fieldMessages[name]) {
      return this.fieldMessages[name];
    }

    const control = this.form.controls[name];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (name === 'price' && control.hasError('min')) {
      return this.translateService.instant('courses.formModal.priceNegative');
    }

    if (name === 'discountPercentage' && (control.hasError('min') || control.hasError('max'))) {
      return this.translateService.instant('courses.discountModal.percentageRange');
    }

    return '';
  }

  get dateRangeInvalid(): boolean {
    return this.form.hasError('dateRange') && (this.form.controls.endDate.touched || this.form.controls.endDate.dirty);
  }

  private loadTrainers(): void {
    this.trainersLoading = true;

    this.adminUserService
      .listTrainers(0, INSTRUCTOR_LIST_PAGE_SIZE, '')
      .pipe(
        finalize(() => {
          this.trainersLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.trainers = result.content;
        },
        error: () => {
          // Fail quiet — the dropdown just stays empty; instructorRequired validation still blocks submit.
        }
      });
  }

  private handleFile(file: File | undefined | null): void {
    if (!file) {
      return;
    }

    this.imageError = '';
    const validationError = validateImageFile(file);

    if (validationError) {
      this.imageError = validationError;
      return;
    }

    this.revokeStagedPreview();
    this.stagedFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  private submitCreate(): void {
    this.serverMessage = '';
    this.fieldMessages = {};
    this.instructorError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.instructorRequired && !this.instructorControl.value) {
      this.instructorError = this.translateService.instant('trainings.form.selectInstructor');
      return;
    }

    this.saving = true;
    const { title, description, price, discountPercentage, startDate, endDate, status } = this.form.getRawValue();

    const payload: TrainingCreateRequest = {
      title,
      description,
      price,
      discountPercentage,
      startDate,
      endDate,
      status,
      image: this.stagedFile ?? undefined,
      instructorId: this.isAdmin && this.instructorControl.value ? this.instructorControl.value : undefined
    };

    this.trainingService
      .createTraining(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (training) => {
          this.toastService.success(this.translateService.instant('trainings.form.trainingCreated'));
          void this.router.navigateByUrl(`/trainings/${training.id}`);
        },
        error: (error) => this.handleSaveError(error)
      });
  }

  private submitEdit(): void {
    if (!this.training || !this.hasChanges) {
      return;
    }

    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildUpdatePayload(this.training);

    if (Object.keys(payload).length === 0) {
      return;
    }

    this.saving = true;
    const trainingId = this.training.id;

    this.trainingService
      .updateTraining(trainingId, payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (updated) => {
          this.toastService.success(this.translateService.instant('trainings.form.trainingUpdated'));
          void this.router.navigateByUrl(`/trainings/${updated.id}`);
        },
        error: (error) => this.handleSaveError(error)
      });
  }

  /** Only sends fields that actually changed from the record this form was loaded with. */
  private buildUpdatePayload(original: TrainingResponse): TrainingUpdateRequest {
    const raw = this.form.getRawValue();
    const payload: TrainingUpdateRequest = {};

    if (raw.title !== original.title) {
      payload.title = raw.title;
    }

    if (raw.description !== original.description) {
      payload.description = raw.description;
    }

    if (raw.price !== original.price) {
      payload.price = raw.price;
    }

    if (raw.discountPercentage !== original.discountPercentage) {
      payload.discountPercentage = raw.discountPercentage;
    }

    if (raw.startDate !== original.startDate) {
      payload.startDate = raw.startDate;
    }

    if (raw.endDate !== original.endDate) {
      payload.endDate = raw.endDate;
    }

    if (raw.status !== original.status) {
      payload.status = raw.status;
    }

    if (this.isAdmin && this.instructorControl.value && this.instructorControl.value !== original.instructorId) {
      payload.instructorId = this.instructorControl.value;
    }

    return payload;
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

    const message = apiError?.message ?? this.translateService.instant('trainings.form.saveError');
    this.serverMessage = message;
    this.toastService.error(message);
  }

  private revokeStagedPreview(): void {
    if (this.stagedFile && this.imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
  }
}
