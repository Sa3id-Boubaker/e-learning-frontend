import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse, MessageResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { AdminUpdateUserRequest, AdminUserResponse, CreateUserByAdminRequest, PageResponse, UserCounts } from './models/admin-user.models';

const ADMIN_BASE_URL = '/api/admin';

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  createUser(data: CreateUserByAdminRequest): Observable<AdminUserResponse> {
    return this.http
      .post<AdminUserResponse>(`${ADMIN_BASE_URL}/users`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  listStudents(page: number, size: number, search: string): Observable<PageResponse<AdminUserResponse>> {
    const params = new HttpParams().set('page', page).set('size', size).set('search', search);

    return this.http
      .get<PageResponse<AdminUserResponse>>(`${ADMIN_BASE_URL}/students`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  listTrainers(page: number, size: number, search: string): Observable<PageResponse<AdminUserResponse>> {
    const params = new HttpParams().set('page', page).set('size', size).set('search', search);

    return this.http
      .get<PageResponse<AdminUserResponse>>(`${ADMIN_BASE_URL}/trainers`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  getUserCounts(): Observable<UserCounts> {
    return this.http
      .get<UserCounts>(`${ADMIN_BASE_URL}/users/counts`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  updateUser(id: string, data: AdminUpdateUserRequest): Observable<AdminUserResponse> {
    return this.http
      .put<AdminUserResponse>(`${ADMIN_BASE_URL}/users/${id}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  deleteUser(id: string): Observable<MessageResponse> {
    return this.http
      .delete<MessageResponse>(`${ADMIN_BASE_URL}/users/${id}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Central 401/403 handling shared by every admin-users call: toast + redirect once here,
   * then re-throw so each call site can still react to its own status codes (400/404/409).
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    const apiError = error?.error as ApiErrorResponse | undefined;

    if (error.status === 401) {
      this.toastService.error(apiError?.message ?? 'Authentication required. Please sign in.');
      void this.router.navigateByUrl('/login');
    } else if (error.status === 403) {
      this.toastService.error(apiError?.message ?? 'You do not have permission to perform this action.');
      void this.router.navigateByUrl('/dashboard/default');
    }

    return throwError(() => error);
  }
}
