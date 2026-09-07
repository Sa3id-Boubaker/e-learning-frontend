import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'en' | 'fr' | 'ar';

export interface LanguageOption {
  code: AppLanguage;
  label: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' }
];

const LANGUAGE_STORAGE_KEY = 'omarise-lang';
const DEFAULT_LANGUAGE: AppLanguage = 'en';
const RTL_LANGUAGES: readonly AppLanguage[] = ['ar'];

/**
 * Applied once eagerly at bootstrap (see provideAppInitializer in main.ts, which injects this
 * service purely to run its constructor before the app's first render) so <html lang>/<html dir>
 * and TranslateService are correct from the very first paint, not just after a later user click.
 */
@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly translateService = inject(TranslateService);

  private readonly currentLangSignal = signal<AppLanguage>(this.readStoredLanguage());
  readonly currentLang = this.currentLangSignal.asReadonly();

  constructor() {
    // Fallback is set here (rather than in provideTranslateService's config) so it loads only
    // after TranslateService has fully finished constructing — see the comment in main.ts.
    this.translateService.setFallbackLang(DEFAULT_LANGUAGE);
    this.applyLanguage(this.currentLangSignal());
  }

  setLanguage(lang: AppLanguage): void {
    if (lang === this.currentLangSignal()) {
      return;
    }

    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    this.currentLangSignal.set(lang);
    this.applyLanguage(lang);
  }

  isRtl(lang: AppLanguage = this.currentLangSignal()): boolean {
    return RTL_LANGUAGES.includes(lang);
  }

  private applyLanguage(lang: AppLanguage): void {
    this.translateService.use(lang);

    // Flipping `dir` moves the sidebar/header from one edge of the screen to the other. CSS
    // transitions written for the sidebar-collapse animation (width/left/right) pick this up too
    // and visibly slide the whole layout across the screen — suppress all transitions for one
    // frame so the direction change snaps instantly instead.
    const root = document.documentElement;
    root.classList.add('lang-switching');
    root.lang = lang;
    root.dir = this.isRtl(lang) ? 'rtl' : 'ltr';
    // Force layout before removing the class, so the dir-change reflow happens while transitions
    // are still suppressed rather than after. The class stays on for a bit rather than just one
    // frame: translated nav labels re-render asynchronously off the onLangChange event, slightly
    // after this synchronous dir flip, and icon margins re-measuring against that new text before
    // transitions re-enable is what avoids a residual "icon jumps to its final spot" animation.
    // 150ms was enough for the small profile dropdown but not the full sidebar nav (many more
    // items to re-render); 400ms comfortably covers it with no perceptible cost to this rare,
    // deliberate action.
    void root.offsetHeight;
    setTimeout(() => root.classList.remove('lang-switching'), 400);
  }

  private readStoredLanguage(): AppLanguage {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return this.isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  }

  private isSupportedLanguage(value: string | null): value is AppLanguage {
    return LANGUAGE_OPTIONS.some((option) => option.code === value);
  }
}
