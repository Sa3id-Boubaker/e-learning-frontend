import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { BellOutline, CheckCircleOutline, CheckOutline, DeleteOutline, MessageOutline, RightOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { formatRelativeTime } from '../format-relative-time';
import { getNotificationIcon } from '../notification-icon';
import { getNotificationRoute } from '../notification-navigation';
import { NotificationResponse } from '../models/notification.models';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-notifications-page',
  imports: [SharedModule, DeleteConfirmationModalComponent],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss'
})
export class NotificationsPageComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);

  @ViewChild('listContainer') listContainer?: ElementRef<HTMLElement>;

  notifications: NotificationResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  markingAllAsRead = false;
  private readonly markingReadIds = new Set<string>();

  deleteModalOpen = false;
  notificationPendingDelete: NotificationResponse | null = null;
  deleteLoading = false;

  readonly formatRelativeTime = formatRelativeTime;
  readonly getNotificationIcon = getNotificationIcon;
  readonly getNotificationRoute = getNotificationRoute;

  constructor() {
    this.iconService.addIcon(...[CheckCircleOutline, CheckOutline, DeleteOutline, BellOutline, RightOutline, MessageOutline]);
  }

  get pageStart(): number {
    return this.totalElements === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 0;
  }

  get hasNextPage(): boolean {
    return this.currentPage + 1 < this.totalPages;
  }

  ngOnInit(): void {
    this.loadNotifications();
  }

  isMarkingRead(notification: NotificationResponse): boolean {
    return this.markingReadIds.has(notification.id);
  }

  loadNotifications(): void {
    this.loading = true;
    this.loadError = '';

    this.notificationService
      .getMyNotifications(this.currentPage, this.pageSize)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.notifications = result.content;
          this.currentPage = result.page;
          this.totalElements = result.totalElements;
          this.totalPages = result.totalPages;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.loadError =
            (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('notifications.page.loadError');
        }
      });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadNotifications();
    this.scrollListToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadNotifications();
    this.scrollListToTop();
  }

  /** Row click: mark-as-read is fired in the background (not awaited) so navigation feels instant. */
  onNotificationClick(notification: NotificationResponse): void {
    this.markAsRead(notification);

    const route = getNotificationRoute(notification);

    if (route) {
      void this.router.navigate(route);
    }
  }

  /** The dedicated per-row "Mark as read" button — same effect as onNotificationClick, minus any navigation. */
  onMarkAsRead(notification: NotificationResponse): void {
    this.markAsRead(notification);
  }

  private markAsRead(notification: NotificationResponse): void {
    if (notification.read || this.markingReadIds.has(notification.id)) {
      return;
    }

    this.markingReadIds.add(notification.id);
    this.notifications = this.notifications.map((existing) => (existing.id === notification.id ? { ...existing, read: true } : existing));

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        this.markingReadIds.delete(notification.id);
        this.notificationService.refreshUnreadCount();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.markingReadIds.delete(notification.id);
        this.notifications = this.notifications.map((existing) =>
          existing.id === notification.id ? { ...existing, read: false } : existing
        );
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('notifications.dropdown.updateError'));
      }
    });
  }

  onMarkAllAsRead(): void {
    if (this.markingAllAsRead) {
      return;
    }

    this.markingAllAsRead = true;
    const previousNotifications = this.notifications;
    this.notifications = this.notifications.map((existing) => ({ ...existing, read: true }));

    this.notificationService
      .markAllAsRead()
      .pipe(
        finalize(() => {
          this.markingAllAsRead = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
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

  openDeleteModal(notification: NotificationResponse): void {
    this.notificationPendingDelete = notification;
    this.deleteModalOpen = true;
  }

  onDeleteModalClosed(): void {
    if (this.deleteLoading) {
      return;
    }

    this.deleteModalOpen = false;
    this.notificationPendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.notificationPendingDelete || this.deleteLoading) {
      return;
    }

    this.deleteLoading = true;
    const notification = this.notificationPendingDelete;

    this.notificationService
      .deleteNotification(notification.id)
      .pipe(
        finalize(() => {
          this.deleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('notifications.page.notificationDeleted'));
          this.deleteModalOpen = false;
          this.notificationPendingDelete = null;

          // Same edge case handled elsewhere in this app (e.g. AdminUsersComponent): deleting
          // the last remaining item on a page beyond the first steps back a page rather than
          // refetching into an empty one.
          if (this.currentPage > 0 && this.notifications.length === 1) {
            this.currentPage -= 1;
          }

          this.loadNotifications();

          if (!notification.read) {
            this.notificationService.refreshUnreadCount();
          }
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('notifications.page.deleteError'));
        }
      });
  }

  private scrollListToTop(): void {
    this.listContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
