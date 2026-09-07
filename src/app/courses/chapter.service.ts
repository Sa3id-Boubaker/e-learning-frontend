import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { ChapterCreateRequest, ChapterResponse, ChapterUpdateRequest } from './models/chapter.models';

const COURSES_BASE_URL = '/api/courses';
const CHAPTERS_BASE_URL = '/api/chapters';

@Injectable({
  providedIn: 'root'
})
export class ChapterService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  getChaptersByCourse(courseId: string): Observable<ChapterResponse[]> {
    return this.http
      .get<ChapterResponse[]>(`${COURSES_BASE_URL}/${courseId}/chapters`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  createChapter(courseId: string, data: ChapterCreateRequest): Observable<ChapterResponse> {
    return this.http
      .post<ChapterResponse>(`${COURSES_BASE_URL}/${courseId}/chapters`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  updateChapter(id: string, data: ChapterUpdateRequest): Observable<ChapterResponse> {
    return this.http
      .put<ChapterResponse>(`${CHAPTERS_BASE_URL}/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  deleteChapter(id: string): Observable<void> {
    return this.http
      .delete<void>(`${CHAPTERS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Same policy as CourseService: only 401 is centralized, 403/404 are per-action and handled by callers. */
  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 401) {
      const apiError = error?.error as ApiErrorResponse | undefined;
      this.toastService.error(apiError?.message ?? 'Authentication required. Please sign in.');
      void this.router.navigateByUrl('/login');
    }

    return throwError(() => error);
  }
}
