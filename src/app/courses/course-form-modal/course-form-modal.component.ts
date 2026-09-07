import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { IconService } from '@ant-design/icons-angular';
import { InboxOutline } from '@ant-design/icons-angular/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { validateAvatarFile as validateImageFile } from '../../profile/avatar-file-validation';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { CourseService } from '../course.service';
import { CourseResponse, CreateCourseRequest, UpdateCourseRequest } from '../models/course.models';

export type CourseFormModalMode = 'create' | 'edit';
type CourseFormFieldName = 'title' | 'description' | 'category' | 'price';

@Component({
  selector: 'app-course-form-modal',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './course-form-modal.component.html',
  styleUrl: './course-form-modal.component.scss'
})
export class CourseFormModalComponent implements OnChanges, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly courseService = inject(CourseService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() mode: CourseFormModalMode = 'create';
  @Input() course: CourseResponse | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<CourseResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: ['', [Validators.required]],
    category: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    published: [false]
  });

  saving = false;
  serverMessage = '';
  fieldMessages: Record<string, string> = {};

  stagedFile: File | null = null;
  imagePreviewUrl: string | null = null;
  imageError = '';
  dragOver = false;

  constructor() {
    this.iconService.addIcon(...[InboxOutline]);
  }

  get hasChanges(): boolean {
    if (this.mode === 'create') {
      return true;
    }

    return !this.form.pristine || this.stagedFile !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.serverMessage = '';
      this.fieldMessages = {};
      this.imageError = '';
      this.dragOver = false;
      this.revokeStagedPreview();
      this.stagedFile = null;

      if (this.mode === 'create') {
        this.form.reset({
          title: '',
          description: '',
          category: '',
          price: 0,
          published: false
        });
        this.imagePreviewUrl = null;
      } else if (this.mode === 'edit' && this.course) {
        this.form.reset({
          title: this.course.title,
          description: this.course.description,
          category: this.course.category,
          price: this.course.price,
          published: this.course.published
        });
        this.imagePreviewUrl = this.course.image;
      }

      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  ngOnDestroy(): void {
    this.revokeStagedPreview();
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

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    this.handleFile(file);
  }

  controlInvalid(name: CourseFormFieldName): boolean {
    if (this.fieldMessages[name]) {
      return true;
    }

    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  messageFor(name: CourseFormFieldName): string {
    if (this.fieldMessages[name]) {
      return this.fieldMessages[name];
    }

    const control = this.form.controls[name];

    if (control.hasError('required')) {
      return this.translateService.instant('courses.formModal.fieldRequired');
    }

    if (name === 'price' && control.hasError('min')) {
      return this.translateService.instant('courses.formModal.priceNegative');
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

  private handleFile(file: File | undefined | null): void {
    if (!file) {
      return;
    }

    this.imageError = '';
    const validationError = validateImageFile(file);

    if (validationError) {
      this.imageError = validationError;
      return;
    }

    this.revokeStagedPreview();
    this.stagedFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  private submitCreate(): void {
    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const { title, description, category, price, published } = this.form.getRawValue();

    const payload: CreateCourseRequest = {
      title,
      description,
      category,
      price,
      published,
      image: this.stagedFile ?? undefined
    };

    this.courseService.createCourse(payload).subscribe({
      next: (course) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.toastService.success(this.translateService.instant('courses.formModal.courseCreated'));
        this.saved.emit(course);
      },
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.handleSaveError(error);
      }
    });
  }

  private submitEdit(): void {
    if (!this.course || !this.hasChanges) {
      return;
    }

    this.serverMessage = '';
    this.fieldMessages = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const courseId = this.course.id;
    const textChanged = !this.form.pristine;
    const imageFile = this.stagedFile;

    if (textChanged) {
      const { title, description, category, price, published } = this.form.getRawValue();
      const payload: UpdateCourseRequest = { title, description, category, price, published };

      this.courseService.updateCourse(courseId, payload).subscribe({
        next: (updated) => {
          if (imageFile) {
            this.uploadImageThenFinish(courseId, imageFile, updated, true);
          } else {
            this.finishEditSuccess(updated);
          }
        },
        error: (error) => {
          this.saving = false;
          this.cdr.markForCheck();
          this.handleSaveError(error);
        }
      });
    } else if (imageFile) {
      this.uploadImageThenFinish(courseId, imageFile, this.course, false);
    }
  }

  private uploadImageThenFinish(courseId: string, file: File, fallback: CourseResponse, textAlreadySaved: boolean): void {
    this.courseService.replaceCourseImage(courseId, file).subscribe({
      next: (updated) => this.finishEditSuccess(updated),
      error: (error) => {
        this.saving = false;
        this.cdr.markForCheck();

        if (textAlreadySaved) {
          this.toastService.error(this.translateService.instant('courses.formModal.imageUploadFailedButSaved'));
          this.saved.emit(fallback);
        } else {
          this.handleSaveError(error);
        }
      }
    });
  }

  private finishEditSuccess(course: CourseResponse): void {
    this.saving = false;
    this.cdr.markForCheck();
    this.toastService.success(this.translateService.instant('courses.formModal.courseUpdated'));
    this.saved.emit(course);
  }

  private handleSaveError(error: unknown): void {
    const httpError = error as { status?: number; error?: ApiErrorResponse };
    const status = httpError?.status;

    if (status === 401) {
      return;
    }

    const apiError = httpError?.error;

    if (status === 400 && apiError?.errors) {
      this.fieldMessages = apiError.errors;
      this.toastService.error(apiError.message ?? this.translateService.instant('courses.formModal.correctFields'));
      return;
    }

    const message = apiError?.message ?? this.translateService.instant('courses.formModal.saveError');
    this.serverMessage = message;
    this.toastService.error(message);
  }

  private revokeStagedPreview(): void {
    if (this.stagedFile && this.imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
