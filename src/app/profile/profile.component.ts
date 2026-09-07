import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../auth/auth.service';
import { ApiErrorResponse, UpdateProfileRequest, UserProfileResponse } from '../auth/models/auth.models';
import { SharedModule } from '../theme/shared/shared.module';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { AvatarPickerModalComponent } from './avatar-picker-modal/avatar-picker-modal.component';

@Component({
  selector: 'app-profile',
  imports: [SharedModule, RouterLink, AvatarPickerModalComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    phone: ['', [Validators.maxLength(20)]],
    bio: ['', [Validators.maxLength(500)]]
  });

  profile: UserProfileResponse | null = null;
  loading = false;
  loadError = '';
  saving = false;
  avatarModalOpen = false;
  fieldMessages: Partial<Record<keyof UpdateProfileRequest, string>> = {};

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading = true;
    this.loadError = '';

    this.authService
      .getProfile()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.patchForm(profile);
        },
        error: (error) => this.handleLoadError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined)
      });
  }

  submit(): void {
    if (this.saving || this.loading || this.form.invalid || this.form.pristine) {
      return;
    }

    this.fieldMessages = {};
    this.saving = true;
    const payload = this.form.getRawValue() satisfies UpdateProfileRequest;

    this.authService
      .updateProfile(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (profile) => {
          this.profile = profile;
          this.patchForm(profile);
          this.toastService.success(this.translateService.instant('profile.updateSuccess'));
        },
        error: (error) => this.handleUpdateError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined)
      });
  }

  openAvatarModal(): void {
    this.avatarModalOpen = true;
  }

  onAvatarModalClosed(): void {
    this.avatarModalOpen = false;
  }

  onAvatarProfileUpdated(profile: UserProfileResponse): void {
    this.profile = profile;
    this.avatarModalOpen = false;
    this.cdr.markForCheck();
  }

  initials(): string {
    const first = this.profile?.firstName?.charAt(0) ?? '';
    const last = this.profile?.lastName?.charAt(0) ?? '';
    const combined = `${first}${last}`.toUpperCase();
    return combined || '?';
  }

  controlInvalid(controlName: keyof UpdateProfileRequest): boolean {
    if (this.fieldMessages[controlName]) {
      return true;
    }

    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(controlName: keyof UpdateProfileRequest): string {
    if (this.fieldMessages[controlName]) {
      return this.fieldMessages[controlName] ?? '';
    }

    const control = this.form.controls[controlName];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (control.hasError('maxlength')) {
      const requiredLength = control.getError('maxlength')?.requiredLength;
      return this.translateService.instant('profile.maxLength', { length: requiredLength });
    }

    return '';
  }

  private patchForm(profile: UserProfileResponse): void {
    this.form.reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? '',
      bio: profile.bio ?? ''
    });
  }

  private handleLoadError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    if (status === 401) {
      this.handleUnauthorized();
      return;
    }

    this.loadError = error?.message ?? this.translateService.instant('profile.loadError');
    this.toastService.error(this.loadError);
  }

  private handleUpdateError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    if (status === 401) {
      this.handleUnauthorized();
      return;
    }

    if (status === 400 && error?.errors) {
      this.fieldMessages = error.errors as Partial<Record<keyof UpdateProfileRequest, string>>;
      this.toastService.error(error.message ?? this.translateService.instant('courses.formModal.correctFields'));
      return;
    }

    this.toastService.error(error?.message ?? this.translateService.instant('profile.updateError'));
  }

  private handleUnauthorized(): void {
    this.toastService.error(this.translateService.instant('profile.sessionExpired'));
    void this.router.navigateByUrl('/login');
  }
}
