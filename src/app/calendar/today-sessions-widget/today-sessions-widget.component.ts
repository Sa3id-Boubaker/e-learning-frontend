import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { finalize } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { ClockCircleOutline, VideoCameraOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { CalendarEventModalComponent } from '../calendar-event-modal/calendar-event-modal.component';
import { CalendarService } from '../calendar.service';
import { CalendarEventResponse } from '../models/calendar-event.models';
import { getLiveSessionStatusBadgeClass } from '../../trainings/live-session-status';
import { formatSessionTime } from '../../trainings/format-session-date-time';
import { SharedModule } from '../../theme/shared/shared.module';

@Component({
  selector: 'app-today-sessions-widget',
  imports: [SharedModule, CalendarEventModalComponent],
  templateUrl: './today-sessions-widget.component.html',
  styleUrl: './today-sessions-widget.component.scss'
})
export class TodaySessionsWidgetComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  events: CalendarEventResponse[] = [];
  loading = false;
  loadError = '';

  modalOpen = false;
  selectedEvent: CalendarEventResponse | null = null;

  readonly getLiveSessionStatusBadgeClass = getLiveSessionStatusBadgeClass;
  readonly formatSessionTime = formatSessionTime;

  constructor() {
    this.iconService.addIcon(...[ClockCircleOutline, VideoCameraOutline]);
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;
    this.loadError = '';

    this.calendarService
      .getToday()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (events) => {
          this.events = events;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.loadError = this.translateService.instant('calendar.todayWidget.loadError');
        }
      });
  }

  openEvent(event: CalendarEventResponse): void {
    this.selectedEvent = event;
    this.modalOpen = true;
  }

  onModalClosed(): void {
    this.modalOpen = false;
    this.selectedEvent = null;
  }
}
