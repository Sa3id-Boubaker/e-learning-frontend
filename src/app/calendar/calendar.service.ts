import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { CalendarEventResponse } from './models/calendar-event.models';

const CALENDAR_BASE_URL = '/api/calendar';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  /**
   * Role-scoped server-side already (ADMIN: everything, FORMATEUR: own trainings, ETUDIANT:
   * PUBLISHED trainings only) — no client-side filtering needed. start/end are required LocalDateTime
   * strings (no timezone suffix); trainingId/status are optional narrowing filters.
   */
  getEvents(start: string, end: string, trainingId?: string, status?: string): Observable<CalendarEventResponse[]> {
    let params = new HttpParams().set('start', start).set('end', end);

    if (trainingId) {
      params = params.set('trainingId', trainingId);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.http
      .get<CalendarEventResponse[]>(CALENDAR_BASE_URL, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Future-only, soonest first. */
  getUpcoming(limit?: number): Observable<CalendarEventResponse[]> {
    let params = new HttpParams();

    if (limit !== undefined) {
      params = params.set('limit', limit);
    }

    return this.http
      .get<CalendarEventResponse[]>(`${CALENDAR_BASE_URL}/upcoming`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** "Today" is resolved server-side in the backend's configured timezone — never computed client-side. */
  getToday(): Observable<CalendarEventResponse[]> {
    return this.http
      .get<CalendarEventResponse[]>(`${CALENDAR_BASE_URL}/today`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Only 401 is centralized here, same policy as the other services — callers inspect status themselves for 400/403/404. */
  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 401) {
      const apiError = error?.error as ApiErrorResponse | undefined;
      this.toastService.error(apiError?.message ?? 'Authentication required. Please sign in.');
      void this.router.navigateByUrl('/login');
    }

    return throwError(() => error);
  }
}
