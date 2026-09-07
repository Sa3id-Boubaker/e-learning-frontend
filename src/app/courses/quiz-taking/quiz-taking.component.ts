import { ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import {
  CheckCircleOutline,
  DownOutline,
  ExclamationCircleOutline,
  HistoryOutline,
  RightOutline,
  SafetyCertificateOutline
} from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { CertificateService } from '../certificate.service';
import { QuestionResponse, QuizAnswerRequest, QuizResponse, QuizResultResponse } from '../models/quiz.models';
import { QuizService } from '../quiz.service';

type QuizTakingMode = 'result' | 'taking';

@Component({
  selector: 'app-quiz-taking',
  imports: [SharedModule],
  templateUrl: './quiz-taking.component.html',
  styleUrl: './quiz-taking.component.scss'
})
export class QuizTakingComponent implements OnInit {
  private readonly quizService = inject(QuizService);
  private readonly certificateService = inject(CertificateService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input({ required: true }) quiz!: QuizResponse;

  loading = true;
  loadError = '';

  mode: QuizTakingMode = 'taking';
  result: QuizResultResponse | null = null;

  answers = new Map<string, string>();
  submitting = false;
  generatingCertificate = false;

  historyOpen = false;
  historyLoaded = false;
  historyLoading = false;
  attempts: QuizResultResponse[] = [];

  constructor() {
    this.iconService.addIcon(
      ...[CheckCircleOutline, ExclamationCircleOutline, HistoryOutline, DownOutline, RightOutline, SafetyCertificateOutline]
    );
  }

  get sortedQuestions(): QuestionResponse[] {
    return [...this.quiz.questions].sort((a, b) => a.order - b.order);
  }

  get unansweredCount(): number {
    return this.quiz.questions.length - this.answers.size;
  }

  get canSubmit(): boolean {
    return this.unansweredCount === 0 && !this.submitting;
  }

  ngOnInit(): void {
    this.loadLatestResult();
  }

  loadLatestResult(): void {
    this.loading = true;
    this.loadError = '';

    this.quizService.getMyResult(this.quiz.id).subscribe({
      next: (result) => {
        this.loading = false;
        this.result = result;
        this.mode = 'result';
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        const status = error?.status as number | undefined;

        if (status === 404) {
          this.result = null;
          this.mode = 'taking';
          this.cdr.markForCheck();
          return;
        }

        if (status === 401) {
          this.cdr.markForCheck();
          return;
        }

        this.loadError = this.translateService.instant('courses.quizTaking.loadStatusError');
        this.cdr.markForCheck();
      }
    });
  }

  isSelected(questionId: string, optionId: string): boolean {
    return this.answers.get(questionId) === optionId;
  }

  selectAnswer(questionId: string, optionId: string): void {
    const updated = new Map(this.answers);
    updated.set(questionId, optionId);
    this.answers = updated;
  }

  retake(): void {
    this.answers = new Map<string, string>();
    this.mode = 'taking';
  }

  submitQuizAnswers(): void {
    if (!this.canSubmit) {
      return;
    }

    this.submitting = true;

    const answers: QuizAnswerRequest[] = Array.from(this.answers.entries()).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId
    }));

    this.quizService.submitQuiz(this.quiz.id, { answers }).subscribe({
      next: (result) => {
        this.submitting = false;
        this.result = result;
        this.mode = 'result';
        this.cdr.markForCheck();

        if (this.historyLoaded) {
          this.loadHistory();
        }
      },
      error: (error) => {
        this.submitting = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;

        if (status === 403) {
          // The backend is the real enforcement point — this should only happen from a stale
          // UI state (e.g. a background tab open since before a passing attempt landed
          // elsewhere). Resync from the server rather than leaving the question form showing.
          this.toastService.error(apiError?.message ?? this.translateService.instant('courses.quizTaking.alreadyPassed'));
          this.loadLatestResult();
          return;
        }

        this.toastService.error(apiError?.message ?? this.translateService.instant('courses.quizTaking.submitError'));
      }
    });
  }

  getCertificate(): void {
    if (this.generatingCertificate) {
      return;
    }

    this.generatingCertificate = true;

    this.certificateService.generateCertificate(this.quiz.courseId).subscribe({
      next: () => {
        this.generatingCertificate = false;
        void this.router.navigate(['/courses', this.quiz.courseId, 'certificate']);
      },
      error: (error) => {
        this.generatingCertificate = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        const apiError = error?.error as ApiErrorResponse | undefined;
        this.toastService.error(apiError?.message ?? this.translateService.instant('courses.quizTaking.certificateError'));
      }
    });
  }

  toggleHistory(): void {
    this.historyOpen = !this.historyOpen;

    if (this.historyOpen && !this.historyLoaded) {
      this.loadHistory();
    }
  }

  private loadHistory(): void {
    this.historyLoading = true;

    this.quizService
      .getMyAttempts(this.quiz.id)
      .pipe(
        finalize(() => {
          this.historyLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (attempts) => {
          this.attempts = attempts;
          this.historyLoaded = true;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.toastService.error(this.translateService.instant('courses.quizTaking.historyError'));
        }
      });
  }
}
