import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, EMPTY, Observable, catchError, distinctUntilChanged, map, of, switchMap, throwError, timer } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { PageResponse } from '../admin/models/admin-user.models';
import { ApiErrorResponse } from '../auth/models/auth.models';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { MarkAllReadResponse, MarkReadResponse, NotificationResponse, UnreadCountResponse } from './models/notification.models';

const NOTIFICATIONS_BASE_URL = '/api/notifications';
const NOTIFICATIONS_STREAM_PATH = '/api/notifications/stream';
// Now a safety-net poll, not the primary mechanism — NotificationStreamService's SSE connection
// (see connectToStream() below) is what keeps the badge current in near-real-time. This just
// reconciles periodically in case that connection silently degrades.
const POLL_INTERVAL_MS = 180000;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);

  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  /** Polled every 45s while logged in; resets to 0 and stops polling as soon as currentUser$ goes null. */
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  constructor() {
    this.authService.currentUser$
      .pipe(
        map((user) => user !== null),
        distinctUntilChanged(),
        switchMap((isLoggedIn) => {
          if (!isLoggedIn) {
            return of(0);
          }

          return timer(0, POLL_INTERVAL_MS).pipe(
            switchMap(() =>
              this.getUnreadCount().pipe(
                map((response) => response.count),
                // A single failed poll shouldn't kill the whole polling loop — just skip that
                // tick and keep the previous badge value until the next one succeeds.
                catchError(() => EMPTY)
              )
            )
          );
        })
      )
      .subscribe((count) => this.unreadCountSubject.next(count));
  }

  getMyNotifications(page: number, size: number): Observable<PageResponse<NotificationResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<NotificationResponse>>(`${NOTIFICATIONS_BASE_URL}/my`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  getUnreadCount(): Observable<UnreadCountResponse> {
    return this.http
      .get<UnreadCountResponse>(`${NOTIFICATIONS_BASE_URL}/my/unread-count`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  markAsRead(id: string): Observable<MarkReadResponse> {
    return this.http
      .patch<MarkReadResponse>(`${NOTIFICATIONS_BASE_URL}/${id}/read`, null, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  markAllAsRead(): Observable<MarkAllReadResponse> {
    return this.http
      .patch<MarkAllReadResponse>(`${NOTIFICATIONS_BASE_URL}/my/read-all`, null, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  deleteNotification(id: string): Observable<void> {
    return this.http
      .delete<void>(`${NOTIFICATIONS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Opens the SSE connection used by NotificationStreamService. */
  connectToStream(): EventSource {
    return new EventSource(`${environment.apiUrl}${NOTIFICATIONS_STREAM_PATH}`, { withCredentials: true });
  }

  /** Lets a caller nudge the badge right after a local mutation (read/read-all/delete) instead of waiting for the next poll tick. */
  refreshUnreadCount(): void {
    this.getUnreadCount().subscribe({
      next: (response) => this.unreadCountSubject.next(response.count),
      error: () => {}
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 401) {
      const apiError = error?.error as ApiErrorResponse | undefined;
      this.toastService.error(apiError?.message ?? 'Authentication required. Please sign in.');
      void this.router.navigateByUrl('/login');
    }

    return throwError(() => error);
  }
}
