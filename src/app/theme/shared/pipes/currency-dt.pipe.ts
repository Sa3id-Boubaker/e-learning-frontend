import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Appends the Tunisian Dinar label to an amount, e.g. "124.65 DT" / "124.65 دينار". Always
 * amount-then-currency, in every language: these render as plain text (not through the HTML bidi
 * algorithm — e.g. ApexCharts draws them as SVG text), so the word simply appears wherever it's
 * placed in source order, with no RTL reordering to account for.
 */
@Pipe({
  name: 'currencyDt',
  pure: false
})
export class CurrencyDtPipe implements PipeTransform {
  private readonly translateService = inject(TranslateService);

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    return `${value} ${this.translateService.instant('common.currency')}`;
  }
}
