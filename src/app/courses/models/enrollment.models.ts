export interface EnrollmentResponse {
  id: string;
  studentId: string;
  courseId: string;
  courseTitle: string;
  amountAtEnrollment: number;
  enrollmentStatus: 'ACTIVE' | 'REVOKED';
  enrolledAt: string;
  activatedAt: string;
  // Absent on GET /api/enrollments/my — present everywhere else (admin-facing endpoints).
  activatedBy?: string;
  // Null (not absent) if the backend's User Service lookup failed — fall back to studentId.
  studentName: string | null;
  studentEmail: string | null;
}

export interface EnrollmentCreateRequest {
  studentId: string;
  courseId: string;
}

export interface CourseAccessResponse {
  courseId: string;
  enrolled: boolean;
  status: 'ACTIVE' | 'REVOKED' | null;
}

export interface MyCourseResponse {
  courseId: string;
  courseTitle: string;
  category: string | null;
  image: string | null;
  progressPercentage: number;
  completed: boolean;
  enrolledAt: string;
}

/** LocalDate ("yyyy-MM-dd") — one of the last 7 calendar days, zero-filled server-side if no activity. */
export interface EnrollmentDailyStat {
  date: string;
  revenue: number;
  count: number;
}

/** ADMIN-only dashboard aggregate. Revenue includes REVOKED enrollments — a revoke is an access correction, not a refund. */
export interface EnrollmentStatsResponse {
  totalRevenue: number;
  totalCount: number;
  dailyStats: EnrollmentDailyStat[];
}

export type TopCourseSortBy = 'revenue' | 'count';

/** ADMIN-only — one row of GET /api/enrollments/stats/top-courses. Same REVOKED-included rule as EnrollmentStatsResponse. */
export interface TopCourseResponse {
  courseId: string;
  courseTitle: string;
  enrollmentCount: number;
  revenue: number;
}

/** FORMATEUR-only — one row of GET /api/enrollments/stats/my-courses, scoped server-side to courses owned by the calling instructor. */
export interface MyCourseStatRow {
  courseId: string;
  courseTitle: string;
  enrollmentCount: number;
  revenue: number;
}

/** FORMATEUR-only — aggregate revenue/count plus a per-course breakdown, for the instructor's own "My Performance" page. */
export interface MyCourseStatsResponse {
  totalRevenue: number;
  totalCount: number;
  courses: MyCourseStatRow[];
}
