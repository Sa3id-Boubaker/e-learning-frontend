import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { IconService } from '@ant-design/icons-angular';
import { BellOutline, CheckCircleOutline, MessageOutline, RightOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { formatRelativeTime } from '../format-relative-time';
import { getNotificationIcon } from '../notification-icon';
import { getNotificationRoute } from '../notification-navigation';
import { NotificationResponse } from '../models/notification.models';
import { NotificationService } from '../notification.service';

const DROPDOWN_PAGE_SIZE = 5;

@Component({
  selector: 'app-notification-dropdown',
  imports: [SharedModule, RouterLink],
  templateUrl: './notification-dropdown.component.html',
  styleUrl: './notification-dropdown.component.scss'
})
export class NotificationDropdownComponent implements OnChanges {
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);

  /** Refetched fresh every time this flips to true — the panel never shows stale state from a previous opening. */
  @Input() open = false;

  /** Emitted only when a click actually navigates away — the parent closes the ngbDropdown panel on this, not on every click. */
  @Output() readonly navigated = new EventEmitter<void>();

  notifications: NotificationResponse[] = [];
  loading = false;

  readonly formatRelativeTime = formatRelativeTime;
  readonly getNotificationIcon = getNotificationIcon;
  readonly getNotificationRoute = getNotificationRoute;

  constructor() {
    this.iconService.addIcon(...[CheckCircleOutline, BellOutline, RightOutline, MessageOutline]);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.loading = true;

    this.notificationService.getMyNotifications(0, DROPDOWN_PAGE_SIZE).subscribe({
      next: (result) => {
        this.loading = false;
        this.notifications = result.content;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }
      }
    });
  }

  onNotificationClick(notification: NotificationResponse): void {
    if (!notification.read) {
      this.markAsRead(notification);
    }

    const route = getNotificationRoute(notification);

    if (route) {
      void this.router.navigate(route);
      // Only navigation closes the panel — an unread notification with no destination just
      // gets marked read in place, panel stays open, matching the previous click behavior.
      this.navigated.emit();
    }
  }

  private markAsRead(notification: NotificationResponse): void {
    this.notifications = this.notifications.map((existing) => (existing.id === notification.id ? { ...existing, read: true } : existing));

    // Fire-and-forget: navigation (if any) already happens synchronously right after this call,
    // it doesn't wait for the response.
    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        this.notificationService.refreshUnreadCount();
      },
      error: (error) => {
        this.notifications = this.notifications.map((existing) =>
          existing.id === notification.id ? { ...existing, read: false } : existing
        );
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        // 403/404 shouldn't normally happen from this UI (users only ever act on their own,
        // currently-listed notifications) — surface it but don't do anything more elaborate.
        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('notifications.dropdown.updateError'));
      }
    });
  }

  onMarkAllAsRead(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const previousNotifications = this.notifications;
    this.notifications = this.notifications.map((existing) => ({ ...existing, read: true }));

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notificationService.refreshUnreadCount();
      },
      error: (error) => {
        this.notifications = previousNotifications;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('notifications.dropdown.markAllError'));
      }
    });
  }
}
