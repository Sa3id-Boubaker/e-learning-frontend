import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, throwError } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { ToastService } from '../../theme/shared/components/toast/toast.service';

const NOT_ENROLLED_MESSAGE = 'You are not enrolled in this course.';

/**
 * Catches the 403 the backend returns from any enrollment-gated endpoint (chapters, videos,
 * progress, quiz, certificate) once a student's access is no longer ACTIVE — including
 * mid-session, if an admin revokes access while the student still has a course page open.
 * Redirects to the course detail page, whose own checkAccess() call renders the locked panel.
 *
 * courseId isn't always present in the failing request's own URL — chapter/video/quiz-question
 * endpoints are scoped by chapterId/quizId, not courseId. Falls back to parsing it off the
 * current route instead, which works here because every one of these calls is only ever made
 * from a page already scoped to a course (/courses/:id, /courses/:id/quiz, ...).
 */
export const enrollmentAccessInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastService = inject(ToastService);
  const translateService = inject(TranslateService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isNotEnrolled = error instanceof HttpErrorResponse && error.status === 403 && error.error?.message === NOT_ENROLLED_MESSAGE;

      if (!isNotEnrolled) {
        return throwError(() => error);
      }

      const courseId = extractCourseId(req.url, router.url);
      const targetUrl = courseId ? `/courses/${courseId}` : '/courses';

      toastService.info(translateService.instant('courses.detail.noLongerHaveAccess'));

      if (router.url !== targetUrl) {
        void router.navigateByUrl(targetUrl);
      }

      return EMPTY;
    })
  );
};

function extractCourseId(requestUrl: string, currentUrl: string): string | null {
  const fromRequestUrl = requestUrl.match(/\/api\/courses\/([^/?]+)/);
  if (fromRequestUrl) {
    return fromRequestUrl[1];
  }

  const fromCurrentRoute = currentUrl.match(/^\/courses\/([^/?]+)(?:[/?]|$)/);
  if (fromCurrentRoute && fromCurrentRoute[1] !== 'manage') {
    return fromCurrentRoute[1];
  }

  return null;
}
