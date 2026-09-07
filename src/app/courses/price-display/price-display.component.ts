import { Component, Input } from '@angular/core';

import { CourseResponse } from '../models/course.models';
import { CurrencyDtPipe } from 'src/app/theme/shared/pipes/currency-dt.pipe';

export type PriceDisplaySize = 'compact' | 'large';

@Component({
  selector: 'app-price-display',
  imports: [CurrencyDtPipe],
  templateUrl: './price-display.component.html',
  styleUrl: './price-display.component.scss'
})
export class PriceDisplayComponent {
  @Input({ required: true }) course!: CourseResponse;
  @Input() size: PriceDisplaySize = 'compact';
}
