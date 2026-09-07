import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Generic destructive-action confirmation modal. It never performs the action itself —
 * the caller owns the API call, passes `loading` down while it's in flight, and closes
 * the modal (sets `open` to false) once it settles.
 *
 * title/description/confirmLabel default to i18n keys and are piped through `translate` in the
 * template — a caller passing already-resolved literal text still works, since ngx-translate
 * returns unknown keys unchanged.
 */
@Component({
  selector: 'app-delete-confirmation-modal',
  imports: [TranslatePipe],
  templateUrl: './delete-confirmation-modal.component.html',
  styleUrl: './delete-confirmation-modal.component.scss'
})
export class DeleteConfirmationModalComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'common.deleteThisItem';
  @Input() description = 'common.actionCannotBeUndone';
  @Input() confirmLabel = 'common.delete';
  @Input() loading = false;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly confirmed = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  onCancel(): void {
    if (this.loading) {
      return;
    }

    this.closed.emit();
  }

  onConfirm(): void {
    if (this.loading) {
      return;
    }

    this.confirmed.emit();
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

    const selector = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
