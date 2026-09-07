import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { PageResponse } from '../admin/models/admin-user.models';
import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import {
  CourseAccessResponse,
  EnrollmentCreateRequest,
  EnrollmentResponse,
  EnrollmentStatsResponse,
  MyCourseResponse,
  MyCourseStatsResponse,
  TopCourseResponse,
  TopCourseSortBy
} from './models/enrollment.models';

const ENROLLMENTS_BASE_URL = '/api/enrollments';
const COURSES_BASE_URL = '/api/courses';

export interface EnrollmentFilters {
  courseId?: string;
  studentId?: string;
  status?: EnrollmentResponse['enrollmentStatus'];
}

@Injectable({
  providedIn: 'root'
})
export class EnrollmentService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  /** ADMIN only. Idempotent — calling again for an already-active pair just returns it, still 201. */
  createEnrollment(studentId: string, courseId: string): Observable<EnrollmentResponse> {
    const data: EnrollmentCreateRequest = { studentId, courseId };

    return this.http
      .post<EnrollmentResponse>(ENROLLMENTS_BASE_URL, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only. courseId/studentId/status are all optional narrowing filters. */
  listAllEnrollments(page: number, size: number, filters: EnrollmentFilters = {}): Observable<PageResponse<EnrollmentResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);

    if (filters.courseId) {
      params = params.set('courseId', filters.courseId);
    }

    if (filters.studentId) {
      params = params.set('studentId', filters.studentId);
    }

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return this.http
      .get<PageResponse<EnrollmentResponse>>(ENROLLMENTS_BASE_URL, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only. Soft-revoke — sets status to REVOKED, does not delete the record. */
  revokeEnrollment(enrollmentId: string): Observable<void> {
    return this.http
      .delete<void>(`${ENROLLMENTS_BASE_URL}/${enrollmentId}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ETUDIANT only. */
  listMyEnrollments(page: number, size: number): Observable<PageResponse<EnrollmentResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<EnrollmentResponse>>(`${ENROLLMENTS_BASE_URL}/my`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ETUDIANT only — the student's personal course library. */
  getMyCourses(page: number, size: number): Observable<PageResponse<MyCourseResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<MyCourseResponse>>(`${ENROLLMENTS_BASE_URL}/my/courses`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Any authenticated role — FORMATEUR/ADMIN always get enrolled: true regardless of records. */
  checkAccess(courseId: string): Observable<CourseAccessResponse> {
    return this.http
      .get<CourseAccessResponse>(`${COURSES_BASE_URL}/${courseId}/access`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only — total revenue/count plus a 7-day daily breakdown, for the admin dashboard. */
  getStats(): Observable<EnrollmentStatsResponse> {
    return this.http
      .get<EnrollmentStatsResponse>(`${ENROLLMENTS_BASE_URL}/stats`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only — top courses ranked by revenue or enrollment count (REVOKED enrollments included, same rule as getStats()). */
  getTopCourses(limit: number, sortBy: TopCourseSortBy): Observable<TopCourseResponse[]> {
    const params = new HttpParams().set('limit', limit).set('sortBy', sortBy);

    return this.http
      .get<TopCourseResponse[]>(`${ENROLLMENTS_BASE_URL}/stats/top-courses`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** FORMATEUR only — aggregate + per-course breakdown, scoped server-side to the calling instructor's own courses (never accepts an instructorId param). */
  getMyCourseStats(): Observable<MyCourseStatsResponse> {
    return this.http
      .get<MyCourseStatsResponse>(`${ENROLLMENTS_BASE_URL}/stats/my-courses`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only. */
  listCourseEnrollments(courseId: string, page: number, size: number): Observable<PageResponse<EnrollmentResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<EnrollmentResponse>>(`${COURSES_BASE_URL}/${courseId}/enrollments`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Only 401 is centralized here, same policy as CourseService/CertificateService — this
   * service is called from contexts with different role requirements (ADMIN-only writes,
   * ETUDIANT-only reads, any-role access checks), so a blanket 403 redirect wouldn't make
   * sense for all of them. Callers inspect status themselves for 403/404.
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
