import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { StudentProgressResponse } from './models/progress.models';

const COURSES_BASE_URL = '/api/courses';

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  getCourseProgress(courseId: string): Observable<StudentProgressResponse> {
    return this.http
      .get<StudentProgressResponse>(`${COURSES_BASE_URL}/${courseId}/progress`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  markVideoComplete(courseId: string, videoId: string): Observable<StudentProgressResponse> {
    return this.http
      .post<StudentProgressResponse>(`${COURSES_BASE_URL}/${courseId}/progress/videos/${videoId}/complete`, null, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
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
