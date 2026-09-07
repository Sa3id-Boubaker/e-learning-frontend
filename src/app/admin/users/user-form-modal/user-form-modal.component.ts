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
import { finalize } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../../auth/models/auth.models';
import { ToastService } from '../../../theme/shared/components/toast/toast.service';
import { AdminUserService } from '../../admin-user.service';
import { AdminManagedRole, AdminUpdateUserRequest, AdminUserResponse, CreateUserByAdminRequest } from '../../models/admin-user.models';

export type UserFormModalMode = 'create' | 'edit';
type EditFormFieldName = 'firstName' | 'lastName' | 'phone' | 'bio' | 'profileImage';

@Component({
  selector: 'app-user-form-modal',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './user-form-modal.component.html',
  styleUrl: './user-form-modal.component.scss'
})
export class UserFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly adminUserService = inject(AdminUserService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() mode: UserFormModalMode = 'create';
  @Input() user: AdminUserResponse | null = null;
  @Input() defaultRole: AdminManagedRole = 'ETUDIANT';

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<AdminUserResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly createForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    role: this.fb.nonNullable.control<AdminManagedRole>('ETUDIANT', [Validators.required])
  });

  readonly editForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    phone: ['', [Validators.maxLength(20)]],
    bio: ['', [Validators.maxLength(500)]],
    profileImage: ['']
  });

  saving = false;
  serverMessage = '';
  fieldMessages: Record<string, string> = {};

  get modalTitle(): string {
    if (this.mode === 'create') {
      return this.translateService.instant(
        this.createForm.controls.role.value === 'FORMATEUR' ? 'admin.users.addTrainer' : 'admin.users.addStudent'
      );
    }

    return this.translateService.instant(this.user?.role === 'FORMATEUR' ? 'admin.userFormModal.editTrainer' : 'admin.userFormModal.editStudent');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.fieldMessages = {};

      if (this.mode === 'create') {
        this.createForm.reset({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          role: this.defaultRole
        });
      } else if (this.mode === 'edit' && this.user) {
        this.editForm.reset({
          firstName: this.user.firstName,
          lastName: this.user.lastName,
          phone: this.user.phone,
          bio: this.user.bio ?? '',
          profileImage: this.user.profileImage ?? ''
        });
      }

      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  submit(): void {
    if (this.saving) {
      return;
    }

    if (this.mode === 'create') {
      this.submitCreate();
    } else {
      this.submitEdit();
    }
  }

  onCancel(): void {
    if (this.saving) {
      return;
    }

    this.closed.emit();
  }

  createControlInvalid(name: keyof CreateUserByAdminRequest): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.createForm.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  createMessageFor(name: keyof CreateUserByAdminRequest): string {
    if (this.fieldMessages[name]) {
      return this.fieldMessages[name];
    }

    const control = this.createForm.controls[name];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (control.hasError('email')) {
      return this.translateService.instant('auth.validation.email');
    }

    return '';
  }

  editControlInvalid(name: EditFormFieldName): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.editForm.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  editMessageFor(name: EditFormFieldName): string {
    if (this.fieldMessages[name]) {
      return this.fieldMessages[name];
    }

    const control = this.editForm.controls[name];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (control.hasError('maxlength')) {
      const requiredLength = control.getError('maxlength')?.requiredLength;
      return this.translateService.instant('profile.maxLength', { length: requiredLength });
    }

    return '';
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

  private submitCreate(): void {
    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const payload = this.createForm.getRawValue() satisfies CreateUserByAdminRequest;

    this.adminUserService
      .createUser(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (user) => {
          const roleKey = user.role === 'FORMATEUR' ? 'admin.userFormModal.trainer' : 'admin.userFormModal.student';
          this.toastService.success(
            this.translateService.instant('admin.userFormModal.userCreated', { role: this.translateService.instant(roleKey) })
          );
          this.saved.emit(user);
        },
        error: (error) => this.handleSaveError(error)
      });
  }

  private submitEdit(): void {
    if (!this.user) {
      return;
    }

    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const payload = this.editForm.getRawValue() satisfies AdminUpdateUserRequest;

    this.adminUserService
      .updateUser(this.user.id, payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (user) => {
          const roleKey = user.role === 'FORMATEUR' ? 'admin.userFormModal.trainer' : 'admin.userFormModal.student';
          this.toastService.success(
            this.translateService.instant('admin.userFormModal.userUpdated', { role: this.translateService.instant(roleKey) })
          );
          this.saved.emit(user);
        },
        error: (error) => this.handleSaveError(error)
      });
  }

  private handleSaveError(error: unknown): void {
    const httpError = error as { status?: number; error?: ApiErrorResponse };
    const status = httpError?.status;

    if (status === 401 || status === 403) {
      return;
    }

    const apiError = httpError?.error;

    if (status === 400 && apiError?.errors) {
      this.fieldMessages = apiError.errors;
      this.toastService.error(apiError.message ?? this.translateService.instant('courses.formModal.correctFields'));
      return;
    }

    if (this.mode === 'create' && status === 409) {
      const message = apiError?.message ?? this.translateService.instant('admin.userFormModal.emailTaken');
      this.fieldMessages = { email: message };
      this.toastService.error(message);
      return;
    }

    if (status === 404) {
      this.toastService.error(apiError?.message ?? this.translateService.instant('admin.userFormModal.userNoLongerExists'));
      return;
    }

    this.serverMessage = apiError?.message ?? this.translateService.instant('admin.userFormModal.saveError');
    this.toastService.error(this.serverMessage);
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
