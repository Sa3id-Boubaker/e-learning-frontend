import { HttpClient, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { RecordingResponse, RecordingUpdateRequest } from './models/recording.models';

const SESSIONS_BASE_URL = '/api/sessions';
const RECORDINGS_BASE_URL = '/api/recordings';

@Injectable({
  providedIn: 'root'
})
export class RecordingService {
  private readonly requestTimeoutMs = 15000;
  // Recording uploads can be a few GB — the default 15s timeout would abort almost immediately.
  private readonly uploadTimeoutMs = 30 * 60 * 1000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  /** 404 (no recording yet) is a normal state — callers decide what to do with it, not this service. */
  getBySession(sessionId: string): Observable<RecordingResponse> {
    return this.http
      .get<RecordingResponse>(`${SESSIONS_BASE_URL}/${sessionId}/recording`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  create(sessionId: string, file: File): Observable<HttpEvent<RecordingResponse>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<RecordingResponse>(`${SESSIONS_BASE_URL}/${sessionId}/recording`, formData, {
        withCredentials: true,
        reportProgress: true,
        observe: 'events'
      })
      .pipe(timeout(this.uploadTimeoutMs), catchError((error) => this.handleError(error)));
  }

  updateMetadata(id: string, data: RecordingUpdateRequest): Observable<RecordingResponse> {
    return this.http
      .put<RecordingResponse>(`${RECORDINGS_BASE_URL}/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  replaceVideo(id: string, file: File): Observable<HttpEvent<RecordingResponse>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<RecordingResponse>(`${RECORDINGS_BASE_URL}/${id}/video`, formData, {
        withCredentials: true,
        reportProgress: true,
        observe: 'events'
      })
      .pipe(timeout(this.uploadTimeoutMs), catchError((error) => this.handleError(error)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`${RECORDINGS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Only 401 is centralized here, same policy as LiveSessionService/TrainingService — the 400
   * ("not completed yet" / bad file type / oversized), 409 ("already exists"), and 403/404 cases
   * are all specific enough that callers handle them themselves.
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
