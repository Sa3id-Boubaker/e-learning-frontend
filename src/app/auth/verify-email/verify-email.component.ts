import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize, Subject, Subscription, takeUntil, timer } from 'rxjs';

import { AuthService } from '../auth.service';
import { ApiErrorResponse, MessageResponse } from '../models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';

type VerifyView = 'form' | 'session-expired' | 'success';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private cooldownSubscription?: Subscription;
  private redirectSubscription?: Subscription;

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  view: VerifyView = 'form';
  loading = false;
  resendLoading = false;
  serverMessage = '';
  inlineMessage = '';
  resendMessage = '';
  resendDisabled = false;
  resendCountdown = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly toastService: ToastService,
    private readonly translateService: TranslateService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cooldownSubscription?.unsubscribe();
    this.redirectSubscription?.unsubscribe();
  }

  submit(): void {
    if (this.loading || this.view !== 'form') {
      return;
    }

    this.inlineMessage = '';
    this.serverMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const code = this.form.controls.code.value;

    this.authService
      .verifyEmail(code)
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => this.handleSuccess(response),
        error: (error) => this.handleError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined)
      });
  }

  resendCode(): void {
    if (this.resendLoading || this.resendDisabled || this.view !== 'form') {
      return;
    }

    this.resendMessage = '';
    this.inlineMessage = '';
    this.resendLoading = true;

    this.authService
      .resendCode()
      .pipe(
        finalize(() => (this.resendLoading = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.toastService.success(response.message || this.translateService.instant('auth.verifyEmail.newCodeSent'));
          this.startCooldown(60);
        },
        error: (error) => this.handleError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined, true)
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
      return this.translateService.instant('auth.verifyEmail.enterCode');
    }

    if (control.hasError('pattern')) {
      return this.translateService.instant('auth.verifyEmail.invalidPattern');
    }

    return '';
  }

  resendText(): string {
    if (this.resendDisabled) {
      return this.translateService.instant('auth.verifyEmail.resendAvailableIn', { seconds: this.resendCountdown });
    }

    return this.translateService.instant(this.resendLoading ? 'auth.verifyEmail.resending' : 'auth.verifyEmail.resendPrompt');
  }

  private handleSuccess(response: MessageResponse): void {
    this.view = 'success';
    this.serverMessage = response.message || this.translateService.instant('auth.verifyEmail.accountVerified');
    this.toastService.success(this.serverMessage);

    this.redirectSubscription?.unsubscribe();
    this.redirectSubscription = timer(1800)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => void this.router.navigateByUrl('/login'));
  }

  private handleError(error: ApiErrorResponse | undefined, status: number | undefined, isResend = false): void {
    const message = error?.message ?? '';

    if (status === 401) {
      this.view = 'session-expired';
      this.serverMessage = this.translateService.instant('auth.verifyEmail.sessionExpiredMessage');
      return;
    }

    if (message.includes('already verified')) {
      this.toastService.info(message);
      this.serverMessage = this.translateService.instant('auth.verifyEmail.alreadyVerified');
      this.redirectSubscription?.unsubscribe();
      this.redirectSubscription = timer(2000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => void this.router.navigateByUrl('/login'));
      return;
    }

    if (message.includes('expired')) {
      this.toastService.error(message || this.translateService.instant('auth.common.genericError'));
      if (isResend) {
        this.resendMessage = this.translateService.instant('auth.verifyEmail.codeExpiredResend');
      } else {
        this.inlineMessage = this.translateService.instant('auth.verifyEmail.codeExpiredInline');
      }
      return;
    }

    if (message.includes('Invalid verification code')) {
      this.toastService.error(message);
      this.inlineMessage = this.translateService.instant('auth.verifyEmail.invalidCode');
      return;
    }

    if (status === 400 && error?.errors?.['code']) {
      this.toastService.error(error.errors['code']);
      this.inlineMessage = error.errors['code'];
      return;
    }

    if (isResend) {
      this.toastService.error(message || this.translateService.instant('auth.common.genericError'));
      this.resendMessage = message || this.translateService.instant('auth.verifyEmail.resendTimeout');
      return;
    }

    this.serverMessage = message || this.translateService.instant('auth.verifyEmail.unableToVerify');
  }

  private startCooldown(seconds: number): void {
    this.cooldownSubscription?.unsubscribe();
    this.resendDisabled = true;
    this.resendCountdown = seconds;

    this.cooldownSubscription = timer(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe((tick) => {
        const remaining = seconds - tick;
        this.resendCountdown = remaining > 0 ? remaining : 0;

        if (remaining <= 0) {
          this.resendDisabled = false;
          this.cooldownSubscription?.unsubscribe();
        }
      });
  }
}