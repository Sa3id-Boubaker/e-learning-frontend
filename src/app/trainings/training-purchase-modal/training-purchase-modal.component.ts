import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';

import { AdminContactComponent } from '../../courses/admin-contact/admin-contact.component';
import { SharedModule } from '../../theme/shared/shared.module';
import { TrainingPriceDisplayComponent } from '../training-price-display/training-price-display.component';
import { TrainingResponse } from '../models/training.models';

/**
 * Purely informational, same spirit as the course-enrollment "locked" card: there's no
 * self-service purchase endpoint, payment is arranged manually by the administration. This just
 * surfaces the existing contact channels (email/WhatsApp/Facebook) via AdminContactComponent,
 * personalized with the training's title.
 */
@Component({
  selector: 'app-training-purchase-modal',
  imports: [SharedModule, AdminContactComponent, TrainingPriceDisplayComponent],
  templateUrl: './training-purchase-modal.component.html',
  styleUrl: './training-purchase-modal.component.scss'
})
export class TrainingPurchaseModalComponent implements OnChanges {
  @Input() open = false;
  @Input() training: TrainingResponse | null = null;

  @Output() readonly closed = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  onKeydownTab(event: Event): void {
    const focusable = this.getFocusableElements();

    if (focusable.length === 0) {
      return;
    }

    const keyboardEvent = event as KeyboardEvent;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (keyboardEvent.shiftKey && active === first) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && active === last) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
