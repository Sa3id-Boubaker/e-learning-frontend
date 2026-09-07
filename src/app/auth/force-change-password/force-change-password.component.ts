import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import { ApiErrorResponse } from '../models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';

type ForceChangePasswordFieldName = 'newPassword' | 'confirmNewPassword';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmNewPassword = group.get('confirmNewPassword')?.value;

  if (!newPassword || !confirmNewPassword || newPassword === confirmNewPassword) {
    return null;
  }

  return { passwordMismatch: true };
}

@Component({
  selector: 'app-force-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './force-change-password.component.html',
  styleUrl: './force-change-password.component.scss'
})
export class ForceChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatchValidator }
  );

  loading = false;
  serverMessage = '';
  fieldMessages: Partial<Record<ForceChangePasswordFieldName, string>> = {};
  showNewPassword = false;
  showConfirmPassword = false;

  submit(): void {
    if (this.loading) {
      return;
    }

    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const { newPassword, confirmNewPassword } = this.form.getRawValue();

    this.authService
      .forceChangePassword(newPassword, confirmNewPassword)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          this.toastService.success(response.message || this.translateService.instant('auth.forceChangePassword.passwordChanged'));
          void this.router.navigateByUrl('/dashboard/default');
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

  controlInvalid(controlName: ForceChangePasswordFieldName): boolean {
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

  messageFor(controlName: ForceChangePasswordFieldName): string {
    if (this.fieldMessages[controlName]) {
      return this.fieldMessages[controlName] ?? '';
    }

    const control = this.form.controls[controlName];

    if (control.hasError('required')) {
      return this.translateService.instant(
        controlName === 'newPassword' ? 'auth.forceChangePassword.enterNewPassword' : 'auth.forceChangePassword.confirmYourPassword'
      );
    }

    if (controlName === 'newPassword' && control.hasError('minlength')) {
      return this.translateService.instant('auth.validation.minLength8');
    }

    if (controlName === 'confirmNewPassword' && this.confirmMismatch()) {
      return this.translateService.instant('auth.forceChangePassword.passwordsDoNotMatch');
    }

    return '';
  }

  private handleError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    if (status === 400 && error?.errors) {
      this.fieldMessages = error.errors as Partial<Record<ForceChangePasswordFieldName, string>>;
      this.toastService.error(error.message ?? this.translateService.instant('auth.common.correctFields'));
      return;
    }

    const message = error?.message ?? '';

    if (message.includes('do not match')) {
      this.fieldMessages = { confirmNewPassword: message };
      this.toastService.error(message);
      return;
    }

    this.serverMessage = message || this.translateService.instant('auth.forceChangePassword.unableToChange');
    this.toastService.error(this.serverMessage);
  }
}
