export type TrainingEnrollmentStatus = 'ACTIVE' | 'REVOKED';

export interface TrainingEnrollmentResponse {
  id: string;
  studentId: string;
  trainingId: string;
  trainingTitle: string;
  amountAtEnrollment: number;
  status: TrainingEnrollmentStatus;
  enrolledAt: string;
  activatedAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Null if the backend's User Service lookup failed — fall back to studentId, same as Course.
  studentName: string | null;
  studentEmail: string | null;
}

export interface TrainingEnrollmentCreateRequest {
  studentId: string;
  trainingId: string;
}

export interface MyTrainingResponse {
  enrollmentId: string;
  trainingId: string;
  trainingTitle: string;
  trainingImage: string | null;
  amountAtEnrollment: number;
  status: TrainingEnrollmentStatus;
  activatedAt: string;
  // LocalDate (no time component), unlike the LocalDateTime fields above.
  startDate: string;
  endDate: string;
}

export interface TrainingAccessResponse {
  trainingId: string;
  enrolled: boolean;
  status: TrainingEnrollmentStatus | null;
}

/** LocalDate ("yyyy-MM-dd") — one of the last 7 calendar days, zero-filled server-side if no activity. */
export interface TrainingEnrollmentDailyStat {
  date: string;
  revenue: number;
  count: number;
}

/** ADMIN-only dashboard aggregate. Revenue includes REVOKED enrollments — a revoke is an access correction, not a refund. */
export interface TrainingEnrollmentStatsResponse {
  totalRevenue: number;
  totalCount: number;
  dailyStats: TrainingEnrollmentDailyStat[];
}

export type TopTrainingSortBy = 'revenue' | 'count';

/** ADMIN-only — one row of GET /api/training-enrollments/stats/top-trainings. Same REVOKED-included rule as TrainingEnrollmentStatsResponse. */
export interface TopTrainingResponse {
  trainingId: string;
  trainingTitle: string;
  enrollmentCount: number;
  revenue: number;
}

/**
 * Any authenticated role — one row of GET /api/training-enrollments/stats/popular-trainings.
 * Trimmed, public-safe sibling of TopTrainingResponse: no revenue field, since students can see
 * this. Same REVOKED-included counting rule.
 */
export interface PopularTrainingResponse {
  trainingId: string;
  trainingTitle: string;
  enrollmentCount: number;
}

/** FORMATEUR-only — one row of GET /api/training-enrollments/stats/my-trainings, scoped server-side to trainings owned by the calling instructor. */
export interface MyTrainingStatRow {
  trainingId: string;
  trainingTitle: string;
  enrollmentCount: number;
  revenue: number;
}

/** FORMATEUR-only — aggregate revenue/count plus a per-training breakdown, for the instructor's own "My Performance" page. */
export interface MyTrainingStatsResponse {
  totalRevenue: number;
  totalCount: number;
  trainings: MyTrainingStatRow[];
}
