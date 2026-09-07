import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { finalize } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { CheckOutline, DeleteOutline, EditOutline, FormOutline, PlusOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { QuestionResponse, QuizResponse } from '../models/quiz.models';
import { QuestionFormModalComponent, QuestionFormModalMode } from '../question-form-modal/question-form-modal.component';
import { QuizFormModalComponent, QuizFormModalMode } from '../quiz-form-modal/quiz-form-modal.component';
import { QuizService } from '../quiz.service';

@Component({
  selector: 'app-quiz-management',
  imports: [SharedModule, QuizFormModalComponent, QuestionFormModalComponent, DeleteConfirmationModalComponent],
  templateUrl: './quiz-management.component.html',
  styleUrl: './quiz-management.component.scss'
})
export class QuizManagementComponent implements OnChanges {
  private readonly quizService = inject(QuizService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input({ required: true }) courseId!: string;
  @Input() quiz: QuizResponse | null = null;

  questions: QuestionResponse[] = [];

  quizFormModalOpen = false;
  quizFormMode: QuizFormModalMode = 'create';

  quizDeleteModalOpen = false;
  quizDeleteLoading = false;

  questionFormModalOpen = false;
  questionFormMode: QuestionFormModalMode = 'create';
  selectedQuestion: QuestionResponse | null = null;

  questionDeleteModalOpen = false;
  questionPendingDelete: QuestionResponse | null = null;
  questionDeleteLoading = false;

  constructor() {
    this.iconService.addIcon(...[EditOutline, DeleteOutline, PlusOutline, CheckOutline, FormOutline]);
  }

  get nextQuestionOrder(): number {
    return this.questions.length + 1;
  }

  get questionDeleteModalTitle(): string {
    return this.questionPendingDelete
      ? this.translateService.instant('courses.quizManagement.deleteQuestionTitleNamed', { text: this.questionPendingDelete.questionText })
      : this.translateService.instant('courses.quizManagement.deleteQuestionTitleGeneric');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['quiz']) {
      this.questions = this.quiz ? [...this.quiz.questions].sort((a, b) => a.order - b.order) : [];
    }
  }

  openCreateQuizModal(): void {
    this.quizFormMode = 'create';
    this.quizFormModalOpen = true;
  }

  openEditQuizModal(): void {
    this.quizFormMode = 'edit';
    this.quizFormModalOpen = true;
  }

  onQuizFormModalClosed(): void {
    this.quizFormModalOpen = false;
  }

  onQuizSaved(quiz: QuizResponse): void {
    this.quiz = quiz;
    this.questions = [...quiz.questions].sort((a, b) => a.order - b.order);
    this.quizFormModalOpen = false;
    this.cdr.markForCheck();
  }

  openDeleteQuizModal(): void {
    this.quizDeleteModalOpen = true;
  }

  onQuizDeleteModalClosed(): void {
    if (this.quizDeleteLoading) {
      return;
    }

    this.quizDeleteModalOpen = false;
  }

  confirmDeleteQuiz(): void {
    if (!this.quiz || this.quizDeleteLoading) {
      return;
    }

    this.quizDeleteLoading = true;

    this.quizService
      .deleteQuiz(this.courseId)
      .pipe(
        finalize(() => {
          this.quizDeleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('courses.quizManagement.quizDeleted'));
          this.quiz = null;
          this.questions = [];
          this.quizDeleteModalOpen = false;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('courses.quizManagement.deleteQuizError'));
        }
      });
  }

  openCreateQuestionModal(): void {
    this.questionFormMode = 'create';
    this.selectedQuestion = null;
    this.questionFormModalOpen = true;
  }

  openEditQuestionModal(question: QuestionResponse): void {
    this.questionFormMode = 'edit';
    this.selectedQuestion = question;
    this.questionFormModalOpen = true;
  }

  onQuestionFormModalClosed(): void {
    this.questionFormModalOpen = false;
  }

  onQuestionSaved(question: QuestionResponse): void {
    if (this.questionFormMode === 'create') {
      this.questions = [...this.questions, question].sort((a, b) => a.order - b.order);
    } else {
      this.questions = this.questions.map((existing) => (existing.id === question.id ? question : existing)).sort((a, b) => a.order - b.order);
    }

    this.questionFormModalOpen = false;
    this.cdr.markForCheck();
  }

  openDeleteQuestionModal(question: QuestionResponse): void {
    this.questionPendingDelete = question;
    this.questionDeleteModalOpen = true;
  }

  onQuestionDeleteModalClosed(): void {
    if (this.questionDeleteLoading) {
      return;
    }

    this.questionDeleteModalOpen = false;
    this.questionPendingDelete = null;
  }

  confirmDeleteQuestion(): void {
    if (!this.quiz || !this.questionPendingDelete || this.questionDeleteLoading) {
      return;
    }

    this.questionDeleteLoading = true;
    const question = this.questionPendingDelete;

    this.quizService
      .deleteQuestion(this.quiz.id, question.id)
      .pipe(
        finalize(() => {
          this.questionDeleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('courses.quizManagement.questionDeleted'));
          this.questions = this.questions.filter((existing) => existing.id !== question.id);
          this.questionDeleteModalOpen = false;
          this.questionPendingDelete = null;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('courses.quizManagement.deleteQuestionError'));
        }
      });
  }
}
