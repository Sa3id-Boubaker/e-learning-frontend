import { enableProdMode, importProvidersFrom, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';

import { environment } from './environments/environment';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideTranslateService } from '@ngx-translate/core';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { mustChangePasswordInterceptor } from './app/auth/interceptors/must-change-password.interceptor';
import { enrollmentAccessInterceptor } from './app/courses/interceptors/enrollment-access.interceptor';
import { loadingInterceptor } from './app/theme/shared/interceptors/loading.interceptor';
import { LanguageService } from './app/theme/shared/service/language.service';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule, AppRoutingModule),
    provideHttpClient(withInterceptors([loadingInterceptor, mustChangePasswordInterceptor, enrollmentAccessInterceptor])),
    provideZonelessChangeDetection(),
    // Neither `lang` nor `fallbackLang` is set here on purpose: either one makes
    // TranslateService's own constructor fire an HTTP load synchronously, DURING its own
    // construction. That request goes through enrollmentAccessInterceptor, which injects
    // TranslateService — a genuine circular dependency (NG0200) that silently loads 0 keys for
    // whichever language was configured here. LanguageService (below) sets both the language and
    // the fallback once TranslateService has fully finished constructing, avoiding the cycle.
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' })
    }),
    // Injecting LanguageService here (rather than waiting for a component to do it) runs its
    // constructor — which applies the stored language/dir preference — before the app's first
    // render, so there's no flash of the wrong <html lang>/<html dir> on load.
    provideAppInitializer(() => {
      inject(LanguageService);
    })
  ]
}).catch((err) => console.error(err));
