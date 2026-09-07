import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import { ApiErrorResponse } from '../models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';

type VerifyResetCodeView = 'form' | 'session-expired';

@Component({
  selector: 'app-verify-reset-code',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './verify-reset-code.component.html',
  styleUrl: './verify-reset-code.component.scss'
})
export class VerifyResetCodeComponent {
  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  view: VerifyResetCodeView = 'form';
  loading = false;
  serverMessage = '';
  inlineMessage = '';

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
    this.inlineMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const code = this.form.controls.code.value;

    this.authService
      .verifyResetCode(code)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.toastService.success(response.message || this.translateService.instant('auth.verifyResetCode.codeVerified'));
          void this.router.navigateByUrl('/reset-password');
        },
        error: (error) => this.handleError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined)
      });
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = input.value.replace(/\D/g, '').slice(0, 6);

    if (input.value !== normalized) {
      input.value = normalized;
    }

    this.form.controls.code.setValue(normalized);
  }

  controlInvalid(): boolean {
    const control = this.form.controls.code;
    return control.invalid && (control.touched || control.dirty);
  }

  codeMessage(): string {
    if (this.inlineMessage) {
      return this.inlineMessage;
    }

    const control = this.form.controls.code;

    if (control.hasError('required')) {
      return this.translateService.instant('auth.verifyResetCode.enterCode');
    }

    if (control.hasError('pattern')) {
      return this.translateService.instant('auth.verifyResetCode.invalidPattern');
    }

    return '';
  }

  private handleError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    const message = error?.message ?? '';

    if (status === 401) {
      this.view = 'session-expired';
      this.serverMessage = message || this.translateService.instant('auth.verifyResetCode.sessionExpiredMessage');
      return;
    }

    if (status === 400) {
      this.inlineMessage = message || this.translateService.instant('auth.verifyResetCode.invalidOrExpired');
      this.toastService.error(this.inlineMessage);
      return;
    }

    this.serverMessage = message || this.translateService.instant('auth.verifyResetCode.unableToVerify');
    this.toastService.error(this.serverMessage);
  }
}
