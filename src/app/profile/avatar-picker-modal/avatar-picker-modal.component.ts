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
import { Subject, finalize, takeUntil } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, AvatarPreset, UserProfileResponse } from '../../auth/models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { validateAvatarFile } from '../avatar-file-validation';

@Component({
  selector: 'app-avatar-picker-modal',
  imports: [TranslatePipe],
  templateUrl: './avatar-picker-modal.component.html',
  styleUrl: './avatar-picker-modal.component.scss'
})
export class AvatarPickerModalComponent implements OnChanges, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @Input() open = false;
  @Input() currentProfileImage: string | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly profileUpdated = new EventEmitter<UserProfileResponse>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly skeletonPlaceholders = [0, 1, 2, 3, 4, 5];

  presets: AvatarPreset[] = [];
  presetsLoading = false;
  presetsError = '';
  selectedPreset: AvatarPreset | null = null;

  applying = false;
  uploading = false;
  uploadError = '';
  dragOver = false;

  get previewUrl(): string | null {
    return this.selectedPreset?.url ?? this.currentProfileImage;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.selectedPreset = null;
      this.uploadError = '';
      this.presetsError = '';
      this.dragOver = false;
      this.loadPresets();
      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPresets(): void {
    this.presetsLoading = true;
    this.presetsError = '';

    this.authService
      .getAvatarPresets()
      .pipe(
        finalize(() => {
          this.presetsLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (presets) => {
          this.presets = presets;
        },
        error: () => {
          this.presetsError = this.translateService.instant('profile.avatarPicker.loadPresetsError');
        }
      });
  }

  selectPreset(preset: AvatarPreset): void {
    this.selectedPreset = preset;
  }

  canApplyPreset(): boolean {
    return !!this.selectedPreset && this.selectedPreset.url !== this.currentProfileImage;
  }

  applyPreset(): void {
    if (!this.canApplyPreset() || this.applying || !this.selectedPreset) {
      return;
    }

    this.applying = true;
    const avatarId = this.selectedPreset.id;

    this.authService
      .setPresetAvatar(avatarId)
      .pipe(
        finalize(() => {
          this.applying = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (profile) => {
          this.toastService.success(this.translateService.instant('profile.avatarPicker.avatarUpdated'));
          this.profileUpdated.emit(profile);
        },
        error: (error) => {
          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('profile.avatarPicker.updateAvatarError'));
        }
      });
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

  onCancel(): void {
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

  private handleFile(file: File | undefined | null): void {
    if (!file || this.uploading) {
      return;
    }

    this.uploadError = '';
    const validationError = validateAvatarFile(file);

    if (validationError) {
      this.uploadError = validationError;
      return;
    }

    this.uploading = true;

    this.authService
      .uploadProfileImage(file)
      .pipe(
        finalize(() => {
          this.uploading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (profile) => {
          this.toastService.success(this.translateService.instant('profile.avatarPicker.pictureUpdated'));
          this.profileUpdated.emit(profile);
        },
        error: (error) => {
          const apiError = error?.error as ApiErrorResponse | undefined;
          this.uploadError = apiError?.message ?? this.translateService.instant('profile.avatarPicker.uploadError');
          this.toastService.error(this.uploadError);
        }
      });
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
