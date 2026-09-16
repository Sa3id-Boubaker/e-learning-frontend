import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import { ApiErrorResponse, ForgotPasswordRequest } from '../models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { SupportContactModalComponent } from '../../theme/layouts/admin-layout/navigation/support-contact-modal/support-contact-modal.component';
import { AuthFooterComponent } from '../auth-footer/auth-footer.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, SupportContactModalComponent, AuthFooterComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  loading = false;
  serverMessage = '';
  fieldMessages: Partial<Record<keyof ForgotPasswordRequest, string>> = {};
  supportModalOpen = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly toastService: ToastService,
    private readonly translateService: TranslateService
  ) {}

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
    const email = this.form.controls.email.value;

    this.authService
      .forgotPassword(email)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.toastService.success(response.message || this.translateService.instant('auth.forgotPassword.codeSent'));
          void this.router.navigateByUrl('/verify-reset-code');
        },
        error: (error) => this.handleError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined)
      });
  }

  controlInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && (control.touched || control.dirty);
  }

  openSupportModal(): void {
    this.supportModalOpen = true;
  }

  onSupportModalClosed(): void {
    this.supportModalOpen = false;
  }

  emailMessage(): string {
    if (this.fieldMessages.email) {
      return this.fieldMessages.email;
    }

    const control = this.form.controls.email;

    if (control.hasError('required')) {
      return this.translateService.instant('auth.forgotPassword.emailRequired');
    }

    if (control.hasError('email')) {
      return this.translateService.instant('auth.validation.email');
    }

    return '';
  }

  private handleError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    if (status === 400 && error?.errors) {
      this.fieldMessages = error.errors as Partial<Record<keyof ForgotPasswordRequest, string>>;
      this.serverMessage = error.message ?? this.translateService.instant('auth.common.correctField');
      return;
    }

    this.serverMessage = error?.message ?? this.translateService.instant('auth.forgotPassword.unableToProcess');
    this.toastService.error(this.serverMessage);
  }
}
