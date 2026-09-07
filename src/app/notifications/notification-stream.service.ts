import { Injectable, inject } from '@angular/core';
import { distinctUntilChanged, map } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { NotificationResponse } from './models/notification.models';
import { NotificationService } from './notification.service';

/**
 * Owns the SSE connection's lifecycle (connect after login, disconnect on logout) and what
 * happens with each message — NotificationService.connectToStream() only knows how to open the
 * connection (and to which URL); this is where "what do we do when a notification arrives"
 * lives: refresh the unread badge and surface a toast.
 *
 * `providedIn: 'root'` on its own doesn't run this constructor — something has to inject it at
 * least once to bootstrap the subscription (NavRightComponent does this, since it's already the
 * permanently-mounted home of the notification bell).
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationStreamService {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);

  private eventSource: EventSource | null = null;

  constructor() {
    this.authService.currentUser$
      .pipe(
        map((user) => user !== null),
        distinctUntilChanged()
      )
      .subscribe((isLoggedIn) => {
        if (isLoggedIn) {
          this.connect();
        } else {
          this.disconnect();
        }
      });
  }

  private connect(): void {
    if (this.eventSource) {
      return;
    }

    this.eventSource = this.notificationService.connectToStream();

    // The backend sends explicitly named SSE events ("event: notification"), not bare
    // unnamed "data: ..." frames — onmessage only fires for the latter, so it silently never
    // fired here even though the browser was receiving the events underneath (visible in
    // DevTools' EventStream panel). addEventListener('notification', ...) is what actually
    // subscribes to this backend's named event.
    this.eventSource.addEventListener('notification', (event: MessageEvent) => {
      this.handleMessage(event);
    });

    // No manual reconnect logic here on purpose: EventSource retries on its own (browser-managed
    // backoff) after a drop. The reduced-frequency poll in NotificationService is the safety net
    // for the gap while a reconnect is in progress, or if the stream never recovers.
    this.eventSource.onerror = () => {};
  }

  private disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  private handleMessage(event: MessageEvent<string>): void {
    let notification: NotificationResponse;

    try {
      notification = JSON.parse(event.data) as NotificationResponse;
    } catch {
      return;
    }

    this.notificationService.refreshUnreadCount();
    this.toastService.info(notification.title);
  }
}
