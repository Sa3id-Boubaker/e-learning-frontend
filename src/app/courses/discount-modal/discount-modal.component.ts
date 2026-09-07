import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { CurrencyDtPipe } from '../../theme/shared/pipes/currency-dt.pipe';
import { CourseService } from '../course.service';
import { CourseResponse } from '../models/course.models';

@Component({
  selector: 'app-discount-modal',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, CurrencyDtPipe],
  templateUrl: './discount-modal.component.html',
  styleUrl: './discount-modal.component.scss'
})
export class DiscountModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly courseService = inject(CourseService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() course: CourseResponse | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<CourseResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    discountPercentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]]
  });

  saving = false;
  removing = false;
  fieldMessage = '';

  get hasActiveDiscount(): boolean {
    return !!this.course && this.course.discountPercentage > 0;
  }

  get previewFinalPrice(): number | null {
    if (!this.course) {
      return null;
    }

    const value = this.form.controls.discountPercentage.value;

    if (value === null || value === undefined || !Number.isFinite(value) || value < 0 || value > 100) {
      return null;
    }

    const raw = this.course.price - (this.course.price * value) / 100;
    return Math.round(raw * 100) / 100;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.fieldMessage = '';
      this.form.reset({ discountPercentage: this.course?.discountPercentage ?? 0 });
      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  onCancel(): void {
    if (this.saving || this.removing) {
      return;
    }

    this.closed.emit();
  }

  controlInvalid(): boolean {
    if (this.fieldMessage) {
      return true;
    }

    const control = this.form.controls.discountPercentage;
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(): string {
    if (this.fieldMessage) {
      return this.fieldMessage;
    }

    const control = this.form.controls.discountPercentage;

    if (control.hasError('required')) {
      return this.translateService.instant('courses.discountModal.enterPercentage');
    }

    if (control.hasError('min') || control.hasError('max')) {
      return this.translateService.instant('courses.discountModal.percentageRange');
    }

    return '';
  }

  submit(): void {
    if (!this.course || this.saving || this.removing) {
      return;
    }

    this.fieldMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const { discountPercentage } = this.form.getRawValue();

    this.courseService.applyDiscount(this.course.id, discountPercentage).subscribe({
      next: (course) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.discountModal.discountApplied'));
        this.saved.emit(course);
      },
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.handleSaveError(error);
      }
    });
  }

  removeDiscount(): void {
    if (!this.course || this.saving || this.removing) {
      return;
    }

    this.removing = true;

    this.courseService.removeDiscount(this.course.id).subscribe({
      next: (course) => {
        this.removing = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.discountModal.discountRemoved'));
        this.saved.emit(course);
      },
      error: (error) => {
        this.removing = false;
        this.cdr.markForCheck();
        this.handleSaveError(error);
      }
    });
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

  private handleSaveError(error: unknown): void {
    const httpError = error as { status?: number; error?: ApiErrorResponse };
    const status = httpError?.status;

    if (status === 401) {
      return;
    }

    const apiError = httpError?.error;

    if (status === 400 && apiError?.errors) {
      this.fieldMessage =
        apiError.errors['discountPercentage'] ?? apiError.message ?? this.translateService.instant('courses.discountModal.invalidPercentage');
      return;
    }

    if (status === 403) {
      this.toastService.error(apiError?.message ?? this.translateService.instant('courses.discountModal.adminOnly'));
      this.closed.emit();
      return;
    }

    this.toastService.error(apiError?.message ?? this.translateService.instant('courses.discountModal.updateError'));
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
