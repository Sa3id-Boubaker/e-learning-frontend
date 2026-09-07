import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { CalendarOptions, DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { TrainingResponse } from '../../trainings/models/training.models';
import { TrainingService } from '../../trainings/training.service';
import { LIVE_SESSION_STATUS_OPTIONS, getLiveSessionStatusLabel } from '../../trainings/live-session-status';
import { LiveSessionStatus } from '../../trainings/models/live-session.models';
import { CalendarEventModalComponent } from '../calendar-event-modal/calendar-event-modal.component';
import { CalendarService } from '../calendar.service';
import { CalendarEventResponse } from '../models/calendar-event.models';
import { TodaySessionsWidgetComponent } from '../today-sessions-widget/today-sessions-widget.component';
import { UpcomingSessionsWidgetComponent } from '../upcoming-sessions-widget/upcoming-sessions-widget.component';

/** A JS Date, as FullCalendar hands it to datesSet, formatted as the LocalDateTime string (no timezone suffix) the backend expects. */
function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

@Component({
  selector: 'app-calendar-view',
  imports: [SharedModule, FullCalendarModule, CalendarEventModalComponent, UpcomingSessionsWidgetComponent, TodaySessionsWidgetComponent],
  templateUrl: './calendar-view.component.html',
  styleUrl: './calendar-view.component.scss'
})
export class CalendarViewComponent implements OnInit, OnDestroy {
  private readonly calendarService = inject(CalendarService);
  private readonly trainingService = inject(TrainingService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  private currentUser: UserProfileResponse | null = null;
  private currentRangeStart: Date | null = null;
  private currentRangeEnd: Date | null = null;
  private eventsById = new Map<string, CalendarEventResponse>();

  loadingEvents = false;
  loadError = '';

  trainings: TrainingResponse[] = [];

  readonly trainingFilterControl = new FormControl('', { nonNullable: true });
  readonly statusFilterControl = new FormControl('', { nonNullable: true });
  readonly statusOptions = LIVE_SESSION_STATUS_OPTIONS;
  readonly getLiveSessionStatusLabel = getLiveSessionStatusLabel;

  eventModalOpen = false;
  selectedEvent: CalendarEventResponse | null = null;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    height: 700,
    expandRows: true,
    // English throughout, matching the rest of this app — the locale is deliberately left at
    // the default (English) rather than following a reference design that happened to be French.
    titleFormat: { month: 'short', day: 'numeric', year: 'numeric' },
    dayHeaderFormat: { weekday: 'short', day: 'numeric' },
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: true },
    events: [],
    datesSet: (arg) => this.onDatesSet(arg),
    eventClick: (arg) => this.onEventClick(arg),
    eventClassNames: (arg) => this.eventClassNames(arg),
    eventContent: (arg) => this.eventContent(arg)
  };

  get showTrainingFilter(): boolean {
    return this.currentUser?.role === 'ADMIN' || this.currentUser?.role === 'FORMATEUR';
  }

  get showStatusFilter(): boolean {
    return this.currentUser?.role === 'ADMIN' || this.currentUser?.role === 'FORMATEUR';
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;

      if (this.showTrainingFilter && this.trainings.length === 0) {
        this.loadTrainings();
      }

      this.cdr.markForCheck();
    });

    this.trainingFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.reloadCurrentRange());
    this.statusFilterControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.reloadCurrentRange());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onModalClosed(): void {
    this.eventModalOpen = false;
    this.selectedEvent = null;
  }

  private loadTrainings(): void {
    this.trainingService.getAllTrainings().subscribe({
      next: (trainings) => {
        this.trainings = trainings;
        this.cdr.markForCheck();
      },
      error: () => {
        // The training filter is a secondary convenience — a failure here shouldn't block the
        // calendar itself from working, just leave the filter dropdown empty.
      }
    });
  }

  private onDatesSet(arg: DatesSetArg): void {
    this.currentRangeStart = arg.start;
    this.currentRangeEnd = arg.end;
    this.loadEvents();
  }

  private reloadCurrentRange(): void {
    if (this.currentRangeStart && this.currentRangeEnd) {
      this.loadEvents();
    }
  }

  private loadEvents(): void {
    if (!this.currentRangeStart || !this.currentRangeEnd) {
      return;
    }

    this.loadingEvents = true;
    this.loadError = '';

    const trainingId = this.trainingFilterControl.value || undefined;
    const status = this.showStatusFilter ? this.statusFilterControl.value || undefined : undefined;

    this.calendarService
      .getEvents(toLocalDateTimeString(this.currentRangeStart), toLocalDateTimeString(this.currentRangeEnd), trainingId, status)
      .subscribe({
        next: (events) => {
          this.loadingEvents = false;
          this.eventsById = new Map(events.map((event) => [event.id, event]));
          this.calendarOptions = {
            ...this.calendarOptions,
            events: events.map((event) => ({
              id: event.id,
              title: event.sessionTitle,
              start: event.startAt,
              end: event.endAt,
              extendedProps: { status: event.status, hasRecording: event.hasRecording }
            }))
          };
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.loadingEvents = false;
          this.cdr.markForCheck();

          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.loadError = this.translateService.instant('calendar.view.loadError');
        }
      });
  }

  private onEventClick(arg: EventClickArg): void {
    const event = this.eventsById.get(arg.event.id);

    if (event) {
      this.selectedEvent = event;
      this.eventModalOpen = true;
      this.cdr.markForCheck();
    }
  }

  private eventClassNames(arg: EventContentArg): string[] {
    const status = (arg.event.extendedProps as { status?: LiveSessionStatus })['status'];
    return status ? [`calendar-event-status-${status.toLowerCase()}`] : [];
  }

  private eventContent(arg: EventContentArg): { domNodes: Node[] } {
    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-event-content';

    const title = document.createElement('span');
    title.className = 'calendar-event-title';
    title.textContent = arg.event.title;
    wrapper.appendChild(title);

    const hasRecording = !!(arg.event.extendedProps as { hasRecording?: boolean })['hasRecording'];

    if (hasRecording) {
      const recordingAvailableLabel = this.translateService.instant('calendar.view.recordingAvailable');
      const icon = document.createElement('i');
      icon.className = 'calendar-event-recording-icon';
      icon.setAttribute('aria-label', recordingAvailableLabel);
      icon.title = recordingAvailableLabel;
      icon.textContent = '\u{1F3A5}';
      wrapper.appendChild(icon);
    }

    return { domNodes: [wrapper] };
  }
}
