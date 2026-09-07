import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';

import { AdminContactComponent } from 'src/app/courses/admin-contact/admin-contact.component';
import { SharedModule } from 'src/app/theme/shared/shared.module';

/** Same modal-shell pattern as TrainingPurchaseModalComponent — wraps AdminContactComponent for the sidebar's "Need help?" card. */
@Component({
  selector: 'app-support-contact-modal',
  imports: [SharedModule, AdminContactComponent],
  templateUrl: './support-contact-modal.component.html',
  styleUrl: './support-contact-modal.component.scss'
})
export class SupportContactModalComponent implements OnChanges {
  @Input() open = false;

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
