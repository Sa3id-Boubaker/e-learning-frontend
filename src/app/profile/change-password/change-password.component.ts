import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, ChangePasswordRequest } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';

type PasswordFieldName = keyof ChangePasswordRequest;

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmNewPassword = group.get('confirmNewPassword')?.value;

  if (!newPassword || !confirmNewPassword || newPassword === confirmNewPassword) {
    return null;
  }

  return { passwordMismatch: true };
}

@Component({
  selector: 'app-change-password',
  imports: [SharedModule, RouterLink],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatchValidator }
  );

  loading = false;
  fieldMessages: Partial<Record<PasswordFieldName, string>> = {};
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  submit(): void {
    if (this.loading) {
      return;
    }

    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const payload = this.form.getRawValue() satisfies ChangePasswordRequest;

    this.authService
      .changePassword(payload)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          this.toastService.success(response.message || this.translateService.instant('profile.changePassword.success'));
          this.form.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
        },
        error: (error) => this.handleError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined)
      });
  }

  toggleShow(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') {
      this.showCurrentPassword = !this.showCurrentPassword;
    } else if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  controlInvalid(controlName: PasswordFieldName): boolean {
    if (this.fieldMessages[controlName]) {
      return true;
    }

    if (controlName === 'confirmNewPassword' && this.confirmMismatch()) {
      return true;
    }

    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  confirmMismatch(): boolean {
    const confirmControl = this.form.controls.confirmNewPassword;
    return this.form.hasError('passwordMismatch') && (confirmControl.touched || confirmControl.dirty) && !confirmControl.hasError('required');
  }

  messageFor(controlName: PasswordFieldName): string {
    if (this.fieldMessages[controlName]) {
      return this.fieldMessages[controlName] ?? '';
    }

    const control = this.form.controls[controlName];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (controlName === 'newPassword' && control.hasError('minlength')) {
      return this.translateService.instant('auth.validation.minLength8');
    }

    if (controlName === 'confirmNewPassword' && this.confirmMismatch()) {
      return this.translateService.instant('auth.resetPassword.passwordsDoNotMatch');
    }

    return '';
  }

  private handleError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    if (status === 401) {
      this.toastService.error(this.translateService.instant('profile.sessionExpired'));
      void this.router.navigateByUrl('/login');
      return;
    }

    if (status === 400 && error?.errors) {
      this.fieldMessages = error.errors as Partial<Record<PasswordFieldName, string>>;
      this.toastService.error(error.message ?? this.translateService.instant('courses.formModal.correctFields'));
      return;
    }

    const message = error?.message ?? '';

    if (message.includes('Current password is incorrect')) {
      this.fieldMessages = { currentPassword: message };
      this.toastService.error(message);
      return;
    }

    if (message.includes('do not match')) {
      this.fieldMessages = { confirmNewPassword: message };
      this.toastService.error(message);
      return;
    }

    this.toastService.error(message || this.translateService.instant('profile.changePassword.error'));
  }
}
