import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { VideoResponse } from '../models/video.models';
import { ProgressService } from '../progress.service';

/**
 * Playback modal with an auto-complete side effect: reaching the native `ended` event marks
 * the video as watched for students. Closing (or the parent flipping `open` to false) removes
 * the `<video>` from the DOM via the surrounding `@if`, which stops playback automatically.
 */
@Component({
  selector: 'app-video-player-modal',
  imports: [TranslatePipe],
  templateUrl: './video-player-modal.component.html',
  styleUrl: './video-player-modal.component.scss'
})
export class VideoPlayerModalComponent implements OnChanges {
  private readonly progressService = inject(ProgressService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() video: VideoResponse | null = null;
  @Input() courseId = '';
  @Input() isStudent = false;
  @Input() alreadyCompleted = false;

  @Output() readonly closed = new EventEmitter<void>();
  /** Emitted the first time THIS viewing session results in a newly-confirmed completion. */
  @Output() readonly videoCompleted = new EventEmitter<string>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  // Tracked separately from `alreadyCompleted` (an @Input) rather than mutating that input
  // directly — mutating an @Input locally can get silently clobbered or, worse, left stale
  // when Angular skips re-writing an input whose newly-computed value happens to match what
  // was last pushed, which would misfire across two different videos opened in sequence.
  private sessionCompleted = false;
  private completing = false;

  get isCompleted(): boolean {
    return this.alreadyCompleted || this.sessionCompleted;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.sessionCompleted = false;
      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  onCancel(): void {
    this.closed.emit();
  }

  onVideoEnded(): void {
    if (!this.isStudent || this.isCompleted || this.completing || !this.video) {
      return;
    }

    const video = this.video;
    this.completing = true;

    this.progressService.markVideoComplete(this.courseId, video.id).subscribe({
      next: () => {
        this.completing = false;
        this.sessionCompleted = true;
        this.toastService.success(this.translateService.instant('courses.videoPlayerModal.videoCompletedToast'));
        this.videoCompleted.emit(video.id);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.completing = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('courses.videoPlayerModal.saveProgressError'));
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

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) {
      return [];
    }

    const selector = 'button:not([disabled]), video, [href], [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
