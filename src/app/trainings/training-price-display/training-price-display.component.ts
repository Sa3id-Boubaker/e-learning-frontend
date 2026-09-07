import { Component, Input } from '@angular/core';

import { TrainingResponse } from '../models/training.models';
import { CurrencyDtPipe } from 'src/app/theme/shared/pipes/currency-dt.pipe';

export type TrainingPriceDisplaySize = 'compact' | 'large';

@Component({
  selector: 'app-training-price-display',
  imports: [CurrencyDtPipe],
  templateUrl: './training-price-display.component.html',
  styleUrl: './training-price-display.component.scss'
})
export class TrainingPriceDisplayComponent {
  @Input({ required: true }) training!: TrainingResponse;
  @Input() size: TrainingPriceDisplaySize = 'compact';
}
