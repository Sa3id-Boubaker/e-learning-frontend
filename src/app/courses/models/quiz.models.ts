export interface OptionResponse {
  id: string;
  text: string;
  // Present only when the caller is FORMATEUR/ADMIN — absent (not null, not false) for
  // ETUDIANT. Student-facing code must never assume a missing value means "false".
  correct?: boolean;
}

export interface QuestionResponse {
  id: string;
  quizId: string;
  questionText: string;
  order: number;
  options: OptionResponse[];
}

export interface QuizResponse {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  passingScore: number;
  questions: QuestionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface QuizCreateRequest {
  title: string;
  description?: string;
  passingScore?: number;
}

export interface QuizUpdateRequest {
  title?: string;
  description?: string;
  passingScore?: number;
}

export interface OptionRequest {
  text: string;
  correct: boolean;
}

export interface QuestionCreateRequest {
  questionText: string;
  order: number;
  options: OptionRequest[];
}

export interface QuestionUpdateRequest {
  questionText?: string;
  order?: number;
  options?: OptionRequest[];
}

export interface QuizAnswerRequest {
  questionId: string;
  selectedOptionId: string;
}

export interface QuizSubmitRequest {
  answers: QuizAnswerRequest[];
}

export interface QuizResultResponse {
  quizId: string;
  courseId: string;
  score: number;
  passingScore: number;
  passed: boolean;
  submittedAt: string;
}
