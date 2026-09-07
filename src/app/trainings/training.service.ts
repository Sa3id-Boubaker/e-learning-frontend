import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import {
  PublicTrainingResponse,
  TrainingCreateRequest,
  TrainingDeletionImpactResponse,
  TrainingResponse,
  TrainingUpdateRequest
} from './models/training.models';

const TRAININGS_BASE_URL = '/api/trainings';

@Injectable({
  providedIn: 'root'
})
export class TrainingService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  /** Role-scoped server-side already (ADMIN: all, FORMATEUR: own, ETUDIANT: PUBLISHED only) — no client-side filtering needed. */
  getAllTrainings(): Observable<TrainingResponse[]> {
    return this.http
      .get<TrainingResponse[]>(TRAININGS_BASE_URL, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Anonymous — no auth, no cookie required. For the public landing page only. Deliberately does
   * NOT go through handleError()/the 401-redirects-to-login path below: this call must never
   * bounce a signed-out landing-page visitor anywhere, even on an unexpected error. Callers should
   * fail soft (e.g. hide the section) rather than surface this error to the visitor.
   */
  getPublicTrainings(limit: number): Observable<PublicTrainingResponse[]> {
    const params = new HttpParams().set('limit', limit);

    return this.http
      .get<PublicTrainingResponse[]>(`${TRAININGS_BASE_URL}/public`, { params })
      .pipe(timeout(this.requestTimeoutMs));
  }

  getTrainingById(id: string): Observable<TrainingResponse> {
    return this.http
      .get<TrainingResponse>(`${TRAININGS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  createTraining(data: TrainingCreateRequest): Observable<TrainingResponse> {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('price', String(data.price));
    formData.append('startDate', data.startDate);
    formData.append('endDate', data.endDate);

    if (data.discountPercentage !== undefined) {
      formData.append('discountPercentage', String(data.discountPercentage));
    }

    if (data.status !== undefined) {
      formData.append('status', data.status);
    }

    if (data.image) {
      formData.append('image', data.image);
    }

    if (data.instructorId) {
      formData.append('instructorId', data.instructorId);
    }

    return this.http
      .post<TrainingResponse>(TRAININGS_BASE_URL, formData, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  updateTraining(id: string, data: TrainingUpdateRequest): Observable<TrainingResponse> {
    return this.http
      .put<TrainingResponse>(`${TRAININGS_BASE_URL}/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  replaceTrainingImage(id: string, file: File): Observable<TrainingResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http
      .post<TrainingResponse>(`${TRAININGS_BASE_URL}/${id}/image`, formData, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Preview of what a cascade DELETE would wipe out — fetched before showing the delete confirmation. */
  getDeletionImpact(id: string): Observable<TrainingDeletionImpactResponse> {
    return this.http
      .get<TrainingDeletionImpactResponse>(`${TRAININGS_BASE_URL}/${id}/deletion-impact`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  deleteTraining(id: string): Observable<void> {
    return this.http
      .delete<void>(`${TRAININGS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Only 401 (no valid session at all) is handled centrally here — same policy as CourseService:
   * training endpoints mix any-role reads with ownership-gated writes, so a 403 from a single
   * write attempt (e.g. editing someone else's training) shouldn't bounce the user off a page
   * they're otherwise allowed to be on. Callers inspect status themselves for that case.
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
