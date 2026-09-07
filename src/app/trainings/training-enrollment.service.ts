import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { PageResponse } from '../admin/models/admin-user.models';
import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import {
  MyTrainingResponse,
  MyTrainingStatsResponse,
  PopularTrainingResponse,
  TopTrainingResponse,
  TopTrainingSortBy,
  TrainingAccessResponse,
  TrainingEnrollmentCreateRequest,
  TrainingEnrollmentResponse,
  TrainingEnrollmentStatsResponse,
  TrainingEnrollmentStatus
} from './models/training-enrollment.models';

const ENROLLMENTS_BASE_URL = '/api/training-enrollments';
const TRAININGS_BASE_URL = '/api/trainings';

export interface TrainingEnrollmentFilters {
  trainingId?: string;
  studentId?: string;
  status?: TrainingEnrollmentStatus;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingEnrollmentService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  /** ADMIN only. Idempotent — calling again for an already-active pair just returns it (201 or 200). */
  createEnrollment(studentId: string, trainingId: string): Observable<TrainingEnrollmentResponse> {
    const data: TrainingEnrollmentCreateRequest = { studentId, trainingId };

    return this.http
      .post<TrainingEnrollmentResponse>(ENROLLMENTS_BASE_URL, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only. trainingId/studentId/status are all optional narrowing filters. */
  listAllEnrollments(
    page: number,
    size: number,
    filters: TrainingEnrollmentFilters = {}
  ): Observable<PageResponse<TrainingEnrollmentResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);

    if (filters.trainingId) {
      params = params.set('trainingId', filters.trainingId);
    }

    if (filters.studentId) {
      params = params.set('studentId', filters.studentId);
    }

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return this.http
      .get<PageResponse<TrainingEnrollmentResponse>>(ENROLLMENTS_BASE_URL, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only — total revenue/count plus a 7-day daily breakdown, for the admin dashboard. */
  getStats(): Observable<TrainingEnrollmentStatsResponse> {
    return this.http
      .get<TrainingEnrollmentStatsResponse>(`${ENROLLMENTS_BASE_URL}/stats`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only — top trainings ranked by revenue or enrollment count (REVOKED enrollments included, same rule as getStats()). */
  getTopTrainings(limit: number, sortBy: TopTrainingSortBy): Observable<TopTrainingResponse[]> {
    const params = new HttpParams().set('limit', limit).set('sortBy', sortBy);

    return this.http
      .get<TopTrainingResponse[]>(`${ENROLLMENTS_BASE_URL}/stats/top-trainings`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Any authenticated role — trimmed, public-safe popularity ranking (no revenue). REVOKED enrollments included, same rule as getStats()/getTopTrainings(). */
  getPopularTrainings(limit: number): Observable<PopularTrainingResponse[]> {
    const params = new HttpParams().set('limit', limit);

    return this.http
      .get<PopularTrainingResponse[]>(`${ENROLLMENTS_BASE_URL}/stats/popular-trainings`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** FORMATEUR only — aggregate + per-training breakdown, scoped server-side to the calling instructor's own trainings (never accepts an instructorId param). */
  getMyTrainingStats(): Observable<MyTrainingStatsResponse> {
    return this.http
      .get<MyTrainingStatsResponse>(`${ENROLLMENTS_BASE_URL}/stats/my-trainings`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only. Soft-revoke — sets status to REVOKED, does not delete the record. */
  revokeEnrollment(enrollmentId: string): Observable<void> {
    return this.http
      .delete<void>(`${ENROLLMENTS_BASE_URL}/${enrollmentId}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ETUDIANT only — studentId comes from the JWT, never sent as a param. */
  listMyTrainings(page: number, size: number): Observable<PageResponse<MyTrainingResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<MyTrainingResponse>>(`${ENROLLMENTS_BASE_URL}/my`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Any authenticated role — ADMIN always, FORMATEUR only if owner, get enrolled: true regardless of records. */
  checkAccess(trainingId: string): Observable<TrainingAccessResponse> {
    return this.http
      .get<TrainingAccessResponse>(`${TRAININGS_BASE_URL}/${trainingId}/access`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Only 401 is centralized here, same policy as EnrollmentService/TrainingService — this
   * service is called from contexts with different role requirements (ADMIN-only writes,
   * ETUDIANT-only reads, any-role access checks), so a blanket 403 redirect wouldn't make sense
   * for all of them. Callers inspect status themselves for 400/403/404/409/503.
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
