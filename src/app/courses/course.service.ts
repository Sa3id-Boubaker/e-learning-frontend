import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { PageResponse } from '../admin/models/admin-user.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { CourseResponse, CourseSummary, CreateCourseRequest, PublicCourseResponse, UpdateCourseRequest } from './models/course.models';

const COURSES_BASE_URL = '/api/courses';

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  getAllCourses(search: string, page: number, size: number): Observable<PageResponse<CourseResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);

    if (search) {
      params = params.set('search', search);
    }

    return this.http
      .get<PageResponse<CourseResponse>>(COURSES_BASE_URL, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Anonymous — no auth, no cookie required. For the public landing page only. Deliberately does
   * NOT go through handleError()/the 401-redirects-to-login path below: this call must never
   * bounce a signed-out landing-page visitor anywhere, even on an unexpected error. Callers should
   * fail soft (e.g. hide the section) rather than surface this error to the visitor.
   */
  getPublicCourses(limit: number): Observable<PublicCourseResponse[]> {
    const params = new HttpParams().set('limit', limit);

    return this.http
      .get<PublicCourseResponse[]>(`${COURSES_BASE_URL}/public`, { params })
      .pipe(timeout(this.requestTimeoutMs));
  }

  /** ADMIN only — unpaginated {id, title} listing for filter dropdowns, not the course catalog. */
  getAllCourseSummaries(): Observable<CourseSummary[]> {
    return this.http
      .get<CourseSummary[]>(`${COURSES_BASE_URL}/summary`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  getCourseById(id: string): Observable<CourseResponse> {
    return this.http
      .get<CourseResponse>(`${COURSES_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  createCourse(data: CreateCourseRequest): Observable<CourseResponse> {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('category', data.category);
    formData.append('price', String(data.price));

    if (data.published !== undefined) {
      formData.append('published', String(data.published));
    }

    if (data.image) {
      formData.append('image', data.image);
    }

    return this.http
      .post<CourseResponse>(COURSES_BASE_URL, formData, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  updateCourse(id: string, data: UpdateCourseRequest): Observable<CourseResponse> {
    return this.http
      .put<CourseResponse>(`${COURSES_BASE_URL}/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  replaceCourseImage(id: string, file: File): Observable<CourseResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<CourseResponse>(`${COURSES_BASE_URL}/${id}/image`, formData, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  deleteCourse(id: string): Observable<void> {
    return this.http
      .delete<void>(`${COURSES_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  applyDiscount(id: string, discountPercentage: number): Observable<CourseResponse> {
    return this.http
      .put<CourseResponse>(`${COURSES_BASE_URL}/${id}/discount`, { discountPercentage }, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  removeDiscount(id: string): Observable<CourseResponse> {
    return this.http
      .delete<CourseResponse>(`${COURSES_BASE_URL}/${id}/discount`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Only 401 (no valid session at all) is handled centrally here — unlike AdminUserService,
   * course endpoints mix public-to-any-role reads with ownership-gated writes, so a 403 from
   * a single write attempt (e.g. editing someone else's course) shouldn't bounce the user off
   * a page they're otherwise allowed to be on. Callers inspect status themselves for that case.
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
