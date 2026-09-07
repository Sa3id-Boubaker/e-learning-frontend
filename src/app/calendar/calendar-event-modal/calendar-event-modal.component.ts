import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { IconService } from '@ant-design/icons-angular';
import { PlayCircleOutline, VideoCameraOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { RecordingService } from '../../trainings/recording.service';
import { getLiveSessionStatusBadgeClass, getLiveSessionStatusLabel, isJoinableLiveSessionStatus } from '../../trainings/live-session-status';
import { formatSessionDateTime } from '../../trainings/format-session-date-time';
import { TrainingAccessResponse } from '../../trainings/models/training-enrollment.models';
import { TrainingEnrollmentService } from '../../trainings/training-enrollment.service';
import { CalendarEventResponse } from '../models/calendar-event.models';

/**
 * The event detail popover, shared by CalendarViewComponent (clicking a grid event) and both
 * dashboard widgets (clicking a list row) — same modal-shell pattern used across this app
 * (VideoFormModalComponent, CourseFormModalComponent, ...).
 */
@Component({
  selector: 'app-calendar-event-modal',
  imports: [SharedModule, RouterLink],
  templateUrl: './calendar-event-modal.component.html',
  styleUrl: './calendar-event-modal.component.scss'
})
export class CalendarEventModalComponent implements OnChanges {
  private readonly recordingService = inject(RecordingService);
  private readonly trainingEnrollmentService = inject(TrainingEnrollmentService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input() open = false;
  @Input() event: CalendarEventResponse | null = null;

  @Output() readonly closed = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  loadingRecording = false;

  // Only populated when the modal opens for a joinable-status event with no meetingUrl — that's
  // the one case where the missing link is ambiguous (not set yet vs. not enrolled) and worth
  // the extra call to disambiguate.
  checkingAccess = false;
  accessResult: TrainingAccessResponse | null = null;

  readonly getLiveSessionStatusLabel = getLiveSessionStatusLabel;
  readonly getLiveSessionStatusBadgeClass = getLiveSessionStatusBadgeClass;
  readonly isJoinableLiveSessionStatus = isJoinableLiveSessionStatus;
  readonly formatSessionDateTime = formatSessionDateTime;

  constructor() {
    this.iconService.addIcon(...[VideoCameraOutline, PlayCircleOutline]);
  }

  /** 'checking' while the access call is in flight, 'not-enrolled' once it resolves that way, 'not-set' otherwise (including on failure — fail open rather than wrongly telling someone they're unenrolled). */
  get meetingUrlUnavailableReason(): 'checking' | 'not-enrolled' | 'not-set' {
    if (this.checkingAccess) {
      return 'checking';
    }

    if (this.accessResult && !this.accessResult.enrolled) {
      return 'not-enrolled';
    }

    return 'not-set';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.checkingAccess = false;
      this.accessResult = null;

      if (this.event && !this.event.meetingUrl && isJoinableLiveSessionStatus(this.event.status)) {
        this.checkAccess(this.event.trainingId);
      }

      setTimeout(() => this.panel?.nativeElement.focus());
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  onWatchRecording(): void {
    if (!this.event || this.loadingRecording) {
      return;
    }

    this.loadingRecording = true;
    const trainingId = this.event.trainingId;

    this.recordingService.getBySession(this.event.sessionId).subscribe({
      next: () => {
        this.loadingRecording = false;
        this.cdr.markForCheck();
        this.closed.emit();
        void this.router.navigateByUrl(`/trainings/${trainingId}`);
      },
      error: (error) => {
        this.loadingRecording = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        if (status === 404) {
          this.toastService.error(this.translateService.instant('calendar.eventModal.recordingUnavailable'));
          return;
        }

        if (status === 403) {
          this.toastService.error(this.translateService.instant('calendar.eventModal.needEnrollmentToWatch'));
          return;
        }

        this.toastService.error(this.translateService.instant('calendar.eventModal.openRecordingError'));
      }
    });
  }

  private checkAccess(trainingId: string): void {
    this.checkingAccess = true;

    this.trainingEnrollmentService.checkAccess(trainingId).subscribe({
      next: (access) => {
        this.checkingAccess = false;
        this.accessResult = access;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.checkingAccess = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        // Fail open, same rationale as TrainingDetailComponent.checkTrainingAccess(): an access-
        // check hiccup shouldn't tell someone they're not enrolled when we don't actually know —
        // default to the more neutral "not set yet" reading instead.
        this.accessResult = { trainingId, enrolled: true, status: null };
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

    const selector = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.nativeElement.querySelectorAll<HTMLElement>(selector));
  }
}
