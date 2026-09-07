import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { LiveSessionCreateRequest, LiveSessionResponse, LiveSessionUpdateRequest } from './models/live-session.models';

const TRAININGS_BASE_URL = '/api/trainings';
const SESSIONS_BASE_URL = '/api/sessions';

@Injectable({
  providedIn: 'root'
})
export class LiveSessionService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  /** Role-scoped server-side already (ADMIN: all, FORMATEUR: own training, ETUDIANT: PUBLISHED training only), sorted by startAt ascending. */
  listByTraining(trainingId: string): Observable<LiveSessionResponse[]> {
    return this.http
      .get<LiveSessionResponse[]>(`${TRAININGS_BASE_URL}/${trainingId}/sessions`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  getById(id: string): Observable<LiveSessionResponse> {
    return this.http
      .get<LiveSessionResponse>(`${SESSIONS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  create(trainingId: string, data: LiveSessionCreateRequest): Observable<LiveSessionResponse> {
    return this.http
      .post<LiveSessionResponse>(`${TRAININGS_BASE_URL}/${trainingId}/sessions`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  update(id: string, data: LiveSessionUpdateRequest): Observable<LiveSessionResponse> {
    return this.http
      .put<LiveSessionResponse>(`${SESSIONS_BASE_URL}/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`${SESSIONS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Only 401 (no valid session at all) is handled centrally here — same policy as
   * TrainingService/CourseService: session endpoints mix any-role reads with ownership-gated
   * writes, so a 403 from a single write attempt shouldn't bounce the user off a page they're
   * otherwise allowed to be on. Callers inspect status themselves for that case (as well as the
   * 400 "end before start" and 409 "overlapping session" cases specific to this feature).
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 401) {
      const apiError = error?.error as ApiErrorResponse | undefined;
      this.toastService.error(apiError?.message ?? 'Authentication required. Please sign in.');
      void this.router.navigateByUrl('/login');
    }

    return throwError(() => error);
  }
}
