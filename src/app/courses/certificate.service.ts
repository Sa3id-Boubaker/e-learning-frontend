import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { PageResponse } from '../admin/models/admin-user.models';
import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import { CertificateResponse } from './models/certificate.models';

const COURSES_BASE_URL = '/api/courses';
const CERTIFICATES_BASE_URL = '/api/certificates';

@Injectable({
  providedIn: 'root'
})
export class CertificateService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  generateCertificate(courseId: string): Observable<CertificateResponse> {
    return this.http
      .post<CertificateResponse>(`${COURSES_BASE_URL}/${courseId}/certificate`, null, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** 404 (not earned yet) is a normal state — callers decide what to do with it, not this service. */
  getMyCertificateForCourse(courseId: string): Observable<CertificateResponse> {
    return this.http
      .get<CertificateResponse>(`${COURSES_BASE_URL}/${courseId}/certificate`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  getMyCertificates(page: number, size: number): Observable<PageResponse<CertificateResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<CertificateResponse>>(`${CERTIFICATES_BASE_URL}/my`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * FORMATEUR can only call this for a course they own (403 otherwise); ADMIN can call it for
   * any course. 403 is left for the caller to handle (e.g. a FORMATEUR who navigated here for
   * a course they don't own) rather than centralized here, same as other ownership-gated calls
   * in this app.
   */
  listCertificatesByCourse(courseId: string, page: number, size: number): Observable<PageResponse<CertificateResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<CertificateResponse>>(`${CERTIFICATES_BASE_URL}/course/${courseId}`, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** ADMIN only — 403 for any other caller. */
  listAllCertificates(page: number, size: number): Observable<PageResponse<CertificateResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http
      .get<PageResponse<CertificateResponse>>(CERTIFICATES_BASE_URL, { params, withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /**
   * Public endpoint — must work for a completely signed-out visitor (e.g. an employer
   * checking a certificate). Deliberately skips the shared 401-redirect error handling below:
   * this page must never bounce an anonymous visitor toward /login. 404 (not found) is a
   * normal state — the caller decides what to show, not this service.
   */
  verifyCertificate(certificateNumber: string): Observable<CertificateResponse> {
    return this.http
      .get<CertificateResponse>(`${CERTIFICATES_BASE_URL}/${certificateNumber}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs));
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
