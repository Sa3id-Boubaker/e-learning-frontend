import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { LockOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { canManageCourse } from '../course-permissions';
import { CourseService } from '../course.service';
import { CourseResponse } from '../models/course.models';
import { QuizResponse } from '../models/quiz.models';
import { ProgressService } from '../progress.service';
import { QuizManagementComponent } from '../quiz-management/quiz-management.component';
import { QuizService } from '../quiz.service';
import { QuizTakingComponent } from '../quiz-taking/quiz-taking.component';

@Component({
  selector: 'app-quiz-page',
  imports: [SharedModule, RouterLink, QuizManagementComponent, QuizTakingComponent],
  templateUrl: './quiz-page.component.html',
  styleUrl: './quiz-page.component.scss'
})
export class QuizPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly courseService = inject(CourseService);
  private readonly quizService = inject(QuizService);
  private readonly progressService = inject(ProgressService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  private readonly destroy$ = new Subject<void>();

  loading = true;
  notFound = false;
  loadError = '';

  course: CourseResponse | null = null;
  quiz: QuizResponse | null = null;
  quizLoaded = false;

  courseCompleted = false;
  progressChecked = false;
  private progressChecking = false;

  currentUser: UserProfileResponse | null = null;
  private courseId = '';

  constructor() {
    this.iconService.addIcon(...[LockOutline]);
  }

  get isStudent(): boolean {
    return this.currentUser?.role === 'ETUDIANT';
  }

  get canManage(): boolean {
    return !!this.course && canManageCourse(this.course, this.currentUser);
  }

  get pageReady(): boolean {
    return !this.loading && this.quizLoaded && this.progressChecked;
  }

  ngOnInit(): void {
    // courseId MUST be set before subscribing below: currentUser$ is a BehaviorSubject, so on
    // in-app navigation (profile already cached from earlier in the session) the subscribe
    // call fires synchronously, immediately — if courseId were still unset at that point,
    // maybeCheckProgress() would fire a progress check against an empty courseId and latch
    // progressChecked = true on the resulting error, permanently blocking the real check that
    // was meant to run later once courseId is actually known.
    this.courseId = this.route.snapshot.paramMap.get('id') ?? '';

    // Same rationale as CourseDetailComponent: currentUser$ can still be at its initial `null`
    // on a hard refresh (the nav bar fetches the real profile asynchronously, no route guard
    // populates it first), so this stays a live subscription and re-triggers the progress
    // check whenever a (possibly late-arriving) role becomes known.
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.maybeCheckProgress();
      this.cdr.markForCheck();
    });

    this.loadCourseAndQuiz();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCourseAndQuiz(): void {
    if (!this.courseId) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    this.loading = true;
    this.loadError = '';
    this.notFound = false;

    this.courseService.getCourseById(this.courseId).subscribe({
      next: (course) => {
        this.course = course;
        this.loadQuiz();
      },
      error: (error) => {
        this.loading = false;
        const status = error?.status as number | undefined;

        if (status === 401) {
          this.cdr.markForCheck();
          return;
        }

        if (status === 404) {
          this.notFound = true;
          this.cdr.markForCheck();
          return;
        }

        this.loadError = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.detail.loadError');
        this.cdr.markForCheck();
      }
    });
  }

  private loadQuiz(): void {
    this.quizService.getQuiz(this.courseId).subscribe({
      next: (quiz) => {
        this.quiz = quiz;
        this.finishLoadingQuiz();
      },
      error: (error) => {
        const status = error?.status as number | undefined;

        if (status === 404) {
          this.quiz = null;
          this.finishLoadingQuiz();
          return;
        }

        this.loading = false;

        if (status === 401) {
          this.cdr.markForCheck();
          return;
        }

        this.loadError = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.quizPage.loadError');
        this.cdr.markForCheck();
      }
    });
  }

  private finishLoadingQuiz(): void {
    this.quizLoaded = true;
    this.loading = false;
    this.maybeCheckProgress();
    this.cdr.markForCheck();
  }

  /**
   * Independently re-checks completion server-side rather than trusting anything passed via
   * router state — a student could navigate straight to this URL. Idempotent: bails once
   * resolved, and again while a check is already in flight, so it's safe to call from both
   * the initial load and the live currentUser$ subscription (in case the role arrives late).
   */
  private maybeCheckProgress(): void {
    if (this.progressChecked || this.progressChecking || !this.currentUser || !this.courseId) {
      return;
    }

    if (this.currentUser.role !== 'ETUDIANT') {
      this.progressChecked = true;
      return;
    }

    this.progressChecking = true;

    this.progressService.getCourseProgress(this.courseId).subscribe({
      next: (progress) => {
        this.progressChecking = false;
        this.courseCompleted = progress.completed;
        this.progressChecked = true;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.progressChecking = false;
        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        // Conservative fallback: an unreadable progress state keeps the quiz locked rather
        // than silently unlocking it on a transient failure.
        this.courseCompleted = false;
        this.progressChecked = true;
        this.cdr.markForCheck();
      }
    });
  }
}
