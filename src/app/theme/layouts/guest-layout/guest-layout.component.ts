import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

import { AppLanguage, LANGUAGE_OPTIONS, LanguageService } from '../../shared/service/language.service';

/**
 * Not in the original i18n spec's step 5 (which only covers the authenticated app's nav-right
 * menu) — added because the auth pages (signin/signup/forgot-password/...) render outside
 * AdminLayout entirely, so a signed-out visitor would otherwise have no way to reach French or
 * Arabic at all. One switcher here covers all guest pages instead of duplicating it 7 times.
 */
@Component({
  selector: 'app-guest-layout',
  imports: [RouterModule, NgbDropdownModule],
  templateUrl: './guest-layout.component.html',
  styleUrl: './guest-layout.component.scss'
})
export class GuestLayoutComponent {
  readonly languageService = inject(LanguageService);
  readonly languageOptions = LANGUAGE_OPTIONS;

  selectLanguage(code: AppLanguage): void {
    this.languageService.setLanguage(code);
  }
}
