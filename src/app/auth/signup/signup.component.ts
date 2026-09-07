import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import { ApiErrorResponse, SignupRequest } from '../models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { GoogleSigninButtonComponent } from '../google-signin-button/google-signin-button.component';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, GoogleSigninButtonComponent, TranslatePipe],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    phone: ['', [Validators.required]]
  });

  loading = false;
  serverMessage = '';
  fieldMessages: Partial<Record<keyof SignupRequest, string>> = {};

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
    const payload = this.form.getRawValue() satisfies SignupRequest;

    this.authService
      .signup(payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
      next: () => {
        this.toastService.success(this.translateService.instant('auth.signup.accountCreated'));
        void this.router.navigateByUrl('/verify-email');
      },
      error: (error) => {
        this.handleError(error?.error as ApiErrorResponse | undefined, error?.status as number | undefined);
      }
    });
  }

  controlInvalid(controlName: keyof SignupRequest): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  controlClass(controlName: keyof SignupRequest): Record<string, boolean> {
    return {
      'is-invalid': this.controlInvalid(controlName)
    };
  }

  messageFor(controlName: keyof SignupRequest): string {
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

    if (controlName === 'password' && control.hasError('minlength')) {
      return this.translateService.instant('auth.validation.minLength8');
    }

    return '';
  }

  private handleError(error: ApiErrorResponse | undefined, status: number | undefined): void {
    if (status === 0 && !error) {
      this.serverMessage = this.translateService.instant('auth.signup.serverTimeout');
      return;
    }

    if (status === 400 && error?.errors) {
      this.fieldMessages = error.errors as Partial<Record<keyof SignupRequest, string>>;
      this.serverMessage = error.message ?? this.translateService.instant('auth.common.correctFields');
      return;
    }

    if (status === 409) {
      this.serverMessage = error?.message ?? this.translateService.instant('auth.signup.emailTaken');
      this.toastService.error(error?.message ?? this.translateService.instant('auth.common.genericError'));
      return;
    }

    this.serverMessage = error?.message ?? this.translateService.instant('auth.signup.unableToCreate');
  }
}
