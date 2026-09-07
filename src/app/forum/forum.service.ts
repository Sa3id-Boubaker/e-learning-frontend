import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { PageResponse } from '../admin/models/admin-user.models';
import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import {
  ForumCommentCreateRequest,
  ForumCommentResponse,
  ForumCommentsCountResponse,
  ForumCommentUpdateRequest,
  ForumPostCreateRequest,
  ForumPostResponse,
  ForumPostType,
  ForumPostUpdateRequest
} from './models/forum.models';

const FORUM_POSTS_BASE_URL = '/api/forum/posts';
const FORUM_COMMENTS_BASE_URL = '/api/forum/comments';

export type ForumPostSort = 'recent' | 'popular';

export interface ForumPostFilters {
  type?: ForumPostType;
  courseId?: string;
  trainingId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ForumService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  listPosts(sort: ForumPostSort, page: number, size: number, filters: ForumPostFilters = {}): Observable<PageResponse<ForumPostResponse>> {
    let params = new HttpParams().set('sort', sort).set('page', page).set('size', size);

    if (filters.type) {
      params = params.set('type', filters.type);
    }

    if (filters.courseId) {
      params = params.set('courseId', filters.courseId);
    }

    if (filters.trainingId) {
      params = params.set('trainingId', filters.trainingId);
    }

    return this.http
      .get<PageResponse<ForumPostResponse>>(FORUM_POSTS_BASE_URL, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  listBookmarked(page: number, size: number): Observable<PageResponse<ForumPostResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<ForumPostResponse>>(`${FORUM_POSTS_BASE_URL}/bookmarked`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  createPost(data: ForumPostCreateRequest): Observable<ForumPostResponse> {
    return this.http
      .post<ForumPostResponse>(FORUM_POSTS_BASE_URL, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN or the post's own author — title/body only, everything else is immutable. */
  updatePost(id: string, data: ForumPostUpdateRequest): Observable<ForumPostResponse> {
    return this.http
      .put<ForumPostResponse>(`${FORUM_POSTS_BASE_URL}/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN or the post's own author. */
  deletePost(id: string): Observable<void> {
    return this.http
      .delete<void>(`${FORUM_POSTS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  getPostById(id: string): Observable<ForumPostResponse> {
    return this.http
      .get<ForumPostResponse>(`${FORUM_POSTS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Oldest-first, per the backend's findByPostIdOrderByCreatedAtAsc. */
  listComments(postId: string, page: number, size: number): Observable<PageResponse<ForumCommentResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<ForumCommentResponse>>(`${FORUM_POSTS_BASE_URL}/${postId}/comments`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  createComment(postId: string, data: ForumCommentCreateRequest): Observable<ForumCommentResponse> {
    return this.http
      .post<ForumCommentResponse>(`${FORUM_POSTS_BASE_URL}/${postId}/comments`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN or the comment's own author. */
  updateComment(id: string, data: ForumCommentUpdateRequest): Observable<ForumCommentResponse> {
    return this.http
      .put<ForumCommentResponse>(`${FORUM_COMMENTS_BASE_URL}/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN or the comment's own author. */
  deleteComment(id: string): Observable<void> {
    return this.http
      .delete<void>(`${FORUM_COMMENTS_BASE_URL}/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only — global comment count across every post, for the admin dashboard. */
  getCommentsCount(): Observable<ForumCommentsCountResponse> {
    return this.http
      .get<ForumCommentsCountResponse>(`${FORUM_COMMENTS_BASE_URL}/count`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** POST is strict — 409 if already bookmarked (unique index server-side). */
  bookmark(postId: string): Observable<void> {
    return this.http
      .post<void>(`${FORUM_POSTS_BASE_URL}/${postId}/bookmark`, {}, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** DELETE is idempotent server-side — never 404s even if not bookmarked. */
  unbookmark(postId: string): Observable<void> {
    return this.http
      .delete<void>(`${FORUM_POSTS_BASE_URL}/${postId}/bookmark`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** POST is strict — 409 if already upvoted (unique index server-side). */
  upvote(postId: string): Observable<void> {
    return this.http
      .post<void>(`${FORUM_POSTS_BASE_URL}/${postId}/upvote`, {}, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** DELETE is idempotent server-side — never 404s even if not upvoted. */
  removeUpvote(postId: string): Observable<void> {
    return this.http
      .delete<void>(`${FORUM_POSTS_BASE_URL}/${postId}/upvote`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** Only 401 is centralized here, same policy as every other service in this app — callers inspect status for 400/403/404/409/503 themselves. */
  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 401) {
      const apiError = error?.error as ApiErrorResponse | undefined;
      this.toastService.error(apiError?.message ?? 'Authentication required. Please sign in.');
      void this.router.navigateByUrl('/login');
    }

    return throwError(() => error);
  }
}
