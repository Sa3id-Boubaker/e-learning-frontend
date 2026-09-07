import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import { ApiErrorResponse, SigninRequest } from '../models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { GoogleSigninButtonComponent } from '../google-signin-button/google-signin-button.component';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, GoogleSigninButtonComponent, TranslatePipe],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent {
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  loading = false;
  serverMessage = '';
  fieldMessages: Partial<Record<keyof SigninRequest, string>> = {};

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
    const payload = this.form.getRawValue() satisfies SigninRequest;

    this.authService
      .signin(payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
      next: (user) => {
        if (user.mustChangePassword) {
          void this.router.navigateByUrl('/force-change-password');
        } else {
          void this.router.navigateByUrl('/dashboard/default');
        }
      },
      error: (error) => {
        this.handleError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined);
      }
    });
  }

  controlInvalid(controlName: keyof SigninRequest): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  controlClass(controlName: keyof SigninRequest): Record<string, boolean> {
    return {
      'is-invalid': this.controlInvalid(controlName)
    };
  }

  messageFor(controlName: keyof SigninRequest): string {
    if (this.fieldMessages[controlName]) {
      return this.fieldMessages[controlName] ?? '';
    }

    const control = this.form.controls[controlName];

    if (control.hasError('required')) {
      return this.translateService.instant('auth.validation.required');
    }

    if (control.hasError('email')) {
      return this.translateService.instant('auth.validation.email');
    }

    return '';
  }

  private handleError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    if (status === 0 && !error) {
      this.serverMessage = this.translateService.instant('auth.signin.serverTimeout');
      return;
    }

    if (status === 400 && error?.errors) {
      this.fieldMessages = error.errors as Partial<Record<keyof SigninRequest, string>>;
      this.serverMessage = error.message ?? this.translateService.instant('auth.common.correctFields');
      return;
    }

    if (status === 401) {
      this.serverMessage = error?.message ?? this.translateService.instant('auth.signin.incorrectCredentials');
      this.toastService.error(error?.message ?? this.translateService.instant('auth.common.genericError'));
      return;
    }

    if (status === 403) {
      this.serverMessage = error?.message ?? this.translateService.instant('auth.signin.notVerified');
      this.toastService.error(error?.message ?? this.translateService.instant('auth.common.genericError'));
      void this.router.navigateByUrl('/verify-email');
      return;
    }

    this.serverMessage = error?.message ?? this.translateService.instant('auth.signin.unableToSignIn');
  }
}
