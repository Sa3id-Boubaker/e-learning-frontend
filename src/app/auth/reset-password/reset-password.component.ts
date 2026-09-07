import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import { ApiErrorResponse } from '../models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';

type ResetPasswordView = 'form' | 'session-expired';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;

  if (!newPassword || !confirmPassword || newPassword === confirmPassword) {
    return null;
  }

  return { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent {
  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatchValidator }
  );

  view: ResetPasswordView = 'form';
  loading = false;
  serverMessage = '';
  showNewPassword = false;
  showConfirmPassword = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly toastService: ToastService,
    private readonly translateService: TranslateService
  ) {}

  submit(): void {
    if (this.loading || this.view !== 'form') {
      return;
    }

    this.serverMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const { newPassword, confirmPassword } = this.form.getRawValue();

    this.authService
      .resetPassword(newPassword, confirmPassword)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.toastService.success(response.message || this.translateService.instant('auth.resetPassword.passwordResetSuccess'));
          void this.router.navigateByUrl('/login');
        },
        error: (error) => this.handleError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined)
      });
  }

  toggleShow(field: 'new' | 'confirm'): void {
    if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  controlInvalid(controlName: 'newPassword' | 'confirmPassword'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  confirmMismatch(): boolean {
    const confirmControl = this.form.controls.confirmPassword;
    return this.form.hasError('passwordMismatch') && (confirmControl.touched || confirmControl.dirty) && !confirmControl.hasError('required');
  }

  newPasswordMessage(): string {
    const control = this.form.controls.newPassword;

    if (control.hasError('required')) {
      return this.translateService.instant('auth.resetPassword.enterNewPassword');
    }

    if (control.hasError('minlength')) {
      return this.translateService.instant('auth.validation.minLength8');
    }

    return '';
  }

  confirmPasswordMessage(): string {
    const control = this.form.controls.confirmPassword;

    if (control.hasError('required')) {
      return this.translateService.instant('auth.resetPassword.confirmYourPassword');
    }

    if (this.confirmMismatch()) {
      return this.translateService.instant('auth.resetPassword.passwordsDoNotMatch');
    }

    return '';
  }

  private handleError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    const message = error?.message ?? '';

    if (status === 401) {
      this.view = 'session-expired';
      this.serverMessage = message || this.translateService.instant('auth.resetPassword.sessionExpiredMessage');
      return;
    }

    this.serverMessage = message || this.translateService.instant('auth.resetPassword.unableToReset');
    this.toastService.error(this.serverMessage);
  }
}
