import { AfterViewInit, Component, DestroyRef, OnDestroy, inject, output, viewChild, ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { AuthService } from '../auth.service';
import { ApiErrorResponse } from '../models/auth.models';
import { LanguageService } from '../../theme/shared/service/language.service';

const SDK_POLL_INTERVAL_MS = 100;
const SDK_POLL_MAX_ATTEMPTS = 50;
const GOOGLE_GSI_SCRIPT_ID = 'google-gsi-client-script';

/**
 * Shared by SigninComponent and SignupComponent — Google sign-in is both "login" and "signup"
 * in one action on the backend side, so both pages render this same button with the same
 * success/error handling, mirroring AuthService.signin()'s existing conventions exactly.
 */
@Component({
  selector: 'app-google-signin-button',
  standalone: true,
  templateUrl: './google-signin-button.component.html'
})
export class GoogleSigninButtonComponent implements AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly buttonRef = viewChild.required<ElementRef<HTMLDivElement>>('googleButton');

  /** Parent pages bind this to their own `serverMessage`, same inline-banner treatment as their existing signin/signup errors. */
  readonly errorMessage = output<string>();

  private pollTimeoutId?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    this.loadGoogleSdkForCurrentLanguage();

    // Google's widget text is baked into the SDK script at load time (via its hl= query param),
    // unlike the rest of this app's | translate-driven text which updates live — so a language
    // switch while this button is mounted needs a fresh script load + re-render to follow suit.
    this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadGoogleSdkForCurrentLanguage();
    });
  }

  ngOnDestroy(): void {
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
    }

    // Cancels any pending One Tap/button prompt so it can't fire a callback after this
    // component (and its handler closures) are gone.
    window.google?.accounts.id.cancel();
  }

  private loadGoogleSdkForCurrentLanguage(): void {
    const lang = this.languageService.currentLang();
    const existingScript = document.getElementById(GOOGLE_GSI_SCRIPT_ID);

    if (existingScript?.getAttribute('data-hl') === lang && window.google?.accounts?.id) {
      this.renderGoogleButton();
      return;
    }

    existingScript?.remove();

    const script = document.createElement('script');
    script.id = GOOGLE_GSI_SCRIPT_ID;
    script.src = `https://accounts.google.com/gsi/client?hl=${lang}`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-hl', lang);
    script.onload = () => this.waitForGoogleSdk();
    document.head.appendChild(script);
  }

  private waitForGoogleSdk(attempt = 0): void {
    if (window.google?.accounts?.id) {
      this.renderGoogleButton();
      return;
    }

    if (attempt >= SDK_POLL_MAX_ATTEMPTS) {
      // The script tag failed to load (network/ad-blocker) — the button area just stays empty
      // rather than throwing, same fail-quiet treatment as other secondary-convenience calls
      // elsewhere in this app (e.g. course-filter dropdowns that fail silently).
      return;
    }

    this.pollTimeoutId = setTimeout(() => this.waitForGoogleSdk(attempt + 1), SDK_POLL_INTERVAL_MS);
  }

  private renderGoogleButton(): void {
    window.google!.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response) => this.handleGoogleCredential(response.credential)
    });

    // Clears any previously rendered button before re-rendering — otherwise a language-change
    // re-render would stack a second Google-drawn button inside the same container.
    this.buttonRef().nativeElement.innerHTML = '';

    window.google!.accounts.id.renderButton(this.buttonRef().nativeElement, {
      theme: 'outline',
      size: 'large',
      width: 300
    });
  }

  /** Mirrors SigninComponent.submit()'s success handler exactly — same mustChangePassword branch, same destinations. */
  private handleGoogleCredential(idToken: string): void {
    this.authService.googleSignIn(idToken).subscribe({
      next: (user) => {
        if (user.mustChangePassword) {
          void this.router.navigateByUrl('/force-change-password');
        } else {
          void this.router.navigateByUrl('/dashboard/default');
        }
      },
      error: (error) => {
        const apiError = error?.error as ApiErrorResponse | undefined;
        const status = error?.status as number | undefined;

        // 403 = this email already belongs to a FORMATEUR/ADMIN account — Google sign-in is
        // students-only, so the backend's own message (telling them to use their password
        // instead) is far more useful here than a generic failure string.
        const fallback =
          status === 403
            ? 'This email is already registered with a password. Please sign in with your password instead.'
            : 'Unable to sign in with Google right now. Please try again.';
        const message = apiError?.message ?? fallback;

        this.errorMessage.emit(message);
        this.toastService.error(message);
      }
    });
  }
}
