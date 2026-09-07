import { HttpClient, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { VideoCreateRequest, VideoResponse, VideoUpdateRequest } from './models/video.models';

const CHAPTERS_BASE_URL = '/api/chapters';
const VIDEOS_BASE_URL = '/api/videos';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private readonly requestTimeoutMs = 15000;
  // Uploads can be up to 500MB — the default 15s timeout would abort a real upload almost
  // immediately, so this call gets a much longer allowance instead.
  private readonly uploadTimeoutMs = 10 * 60 * 1000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  getVideosByChapter(chapterId: string): Observable<VideoResponse[]> {
    return this.http
      .get<VideoResponse[]>(`${CHAPTERS_BASE_URL}/${chapterId}/videos`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  createVideo(chapterId: string, data: VideoCreateRequest): Observable<HttpEvent<VideoResponse>> {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('order', String(data.order));
    formData.append('video', data.file);

    if (data.description) {
      formData.append('description', data.description);
    }

    return this.http
      .post<VideoResponse>(`${CHAPTERS_BASE_URL}/${chapterId}/videos`, formData, {
        withCredentials: true,
        reportProgress: true,
        observe: 'events'
      })
      .pipe(timeout(this.uploadTimeoutMs), catchError((error) => this.handleError(error)));
  }

  updateVideo(id: string, data: VideoUpdateRequest): Observable<VideoResponse> {
    return this.http
      .put<VideoResponse>(`${VIDEOS_BASE_URL}/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  deleteVideo(id: string): Observable<void> {
    return this.http
      .delete<void>(`${VIDEOS_BASE_URL}/${id}`, { withCredentials: true })
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
