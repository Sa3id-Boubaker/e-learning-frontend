import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { ApiErrorResponse } from '../auth/models/auth.models';
import { ToastService } from '../theme/shared/components/toast/toast.service';
import {
  QuestionCreateRequest,
  QuestionResponse,
  QuestionUpdateRequest,
  QuizCreateRequest,
  QuizResponse,
  QuizResultResponse,
  QuizSubmitRequest,
  QuizUpdateRequest
} from './models/quiz.models';

const COURSES_BASE_URL = '/api/courses';
const QUIZZES_BASE_URL = '/api/quizzes';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private readonly requestTimeoutMs = 15000;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  /** 404 (no quiz yet) is a normal state — callers decide what to do with it, not this service. */
  getQuiz(courseId: string): Observable<QuizResponse> {
    return this.http
      .get<QuizResponse>(`${COURSES_BASE_URL}/${courseId}/quiz`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  createQuiz(courseId: string, data: QuizCreateRequest): Observable<QuizResponse> {
    return this.http
      .post<QuizResponse>(`${COURSES_BASE_URL}/${courseId}/quiz`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  updateQuiz(courseId: string, data: QuizUpdateRequest): Observable<QuizResponse> {
    return this.http
      .put<QuizResponse>(`${COURSES_BASE_URL}/${courseId}/quiz`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  deleteQuiz(courseId: string): Observable<void> {
    return this.http
      .delete<void>(`${COURSES_BASE_URL}/${courseId}/quiz`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  getQuestions(quizId: string): Observable<QuestionResponse[]> {
    return this.http
      .get<QuestionResponse[]>(`${QUIZZES_BASE_URL}/${quizId}/questions`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  createQuestion(quizId: string, data: QuestionCreateRequest): Observable<QuestionResponse> {
    return this.http
      .post<QuestionResponse>(`${QUIZZES_BASE_URL}/${quizId}/questions`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  updateQuestion(quizId: string, questionId: string, data: QuestionUpdateRequest): Observable<QuestionResponse> {
    return this.http
      .put<QuestionResponse>(`${QUIZZES_BASE_URL}/${quizId}/questions/${questionId}`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  deleteQuestion(quizId: string, questionId: string): Observable<void> {
    return this.http
      .delete<void>(`${QUIZZES_BASE_URL}/${quizId}/questions/${questionId}`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  submitQuiz(quizId: string, data: QuizSubmitRequest): Observable<QuizResultResponse> {
    return this.http
      .post<QuizResultResponse>(`${QUIZZES_BASE_URL}/${quizId}/submit`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  /** 404 (never attempted) is a normal state — callers decide what to do with it, not this service. */
  getMyResult(quizId: string): Observable<QuizResultResponse> {
    return this.http
      .get<QuizResultResponse>(`${QUIZZES_BASE_URL}/${quizId}/my-result`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs), catchError((error) => this.handleError(error)));
  }

  getMyAttempts(quizId: string): Observable<QuizResultResponse[]> {
    return this.http
      .get<QuizResultResponse[]>(`${QUIZZES_BASE_URL}/${quizId}/my-attempts`, { withCredentials: true })
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
