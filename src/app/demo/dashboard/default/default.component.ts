// angular import
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, finalize, forkJoin, takeUntil } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// project import
import { AuthService } from 'src/app/auth/auth.service';
import { UserProfileResponse } from 'src/app/auth/models/auth.models';
import { AdminUserService } from 'src/app/admin/admin-user.service';
import { PageResponse, UserCounts } from 'src/app/admin/models/admin-user.models';
import { CourseService } from 'src/app/courses/course.service';
import { CourseResponse } from 'src/app/courses/models/course.models';
import { CertificateService } from 'src/app/courses/certificate.service';
import { CertificateResponse } from 'src/app/courses/models/certificate.models';
import { EnrollmentService } from 'src/app/courses/enrollment.service';
import {
  EnrollmentDailyStat,
  EnrollmentResponse,
  EnrollmentStatsResponse,
  MyCourseResponse,
  MyCourseStatsResponse,
  TopCourseResponse
} from 'src/app/courses/models/enrollment.models';
import { getEnrollmentStatusBadgeClass, getEnrollmentStatusLabel } from 'src/app/courses/enrollment-status';
import { TrainingService } from 'src/app/trainings/training.service';
import { TrainingResponse } from 'src/app/trainings/models/training.models';
import { TrainingEnrollmentService } from 'src/app/trainings/training-enrollment.service';
import {
  MyTrainingResponse,
  MyTrainingStatsResponse,
  PopularTrainingResponse,
  TopTrainingResponse,
  TrainingEnrollmentDailyStat,
  TrainingEnrollmentResponse,
  TrainingEnrollmentStatsResponse
} from 'src/app/trainings/models/training-enrollment.models';
import {
  formatSessionDate,
  formatSessionDayNumber,
  formatSessionMonthAbbrev,
  formatSessionTime
} from 'src/app/trainings/format-session-date-time';
import { CalendarService } from 'src/app/calendar/calendar.service';
import { CalendarEventResponse } from 'src/app/calendar/models/calendar-event.models';
import { ForumService } from 'src/app/forum/forum.service';
import { ForumCommentsCountResponse, ForumPostResponse } from 'src/app/forum/models/forum.models';
import { formatDashboardDayLabel } from './dashboard-date';

import { IncomeOverviewChartComponent } from 'src/app/theme/shared/apexchart/income-overview-chart/income-overview-chart.component';
import { AnalyticsChartComponent } from 'src/app/theme/shared/apexchart/analytics-chart/analytics-chart.component';
import { SalesReportChartComponent } from 'src/app/theme/shared/apexchart/sales-report-chart/sales-report-chart.component';
import { TopPerformersChartComponent } from 'src/app/theme/shared/apexchart/top-performers-chart/top-performers-chart.component';

// icons
import { IconService, IconDirective } from '@ant-design/icons-angular';
import {
  DollarOutline,
  MessageOutline,
  PictureOutline,
  ReadOutline,
  RightOutline,
  SafetyCertificateOutline,
  ScheduleOutline,
  SolutionOutline,
  TeamOutline
} from '@ant-design/icons-angular/icons';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { CurrencyDtPipe } from 'src/app/theme/shared/pipes/currency-dt.pipe';

interface DashboardStatCard {
  title: string;
  value: string;
  icon: string;
  colorClass: string;
  subtext: string;
}

interface MergedDailyStat {
  date: string;
  revenue: number;
  count: number;
}

type RecentEnrollmentStatus = EnrollmentResponse['enrollmentStatus'];

interface RecentEnrollmentRow {
  id: string;
  type: 'Course' | 'Training';
  studentName: string;
  itemTitle: string;
  amount: number;
  status: RecentEnrollmentStatus;
  date: string;
}

interface TopPerformerRow {
  id: string;
  type: 'Course' | 'Training';
  title: string;
  enrollmentCount: number;
  revenue: number;
}

interface DashboardLoadResult {
  userCounts: UserCounts;
  courseStats: EnrollmentStatsResponse;
  trainingStats: TrainingEnrollmentStatsResponse;
  certificates: PageResponse<CertificateResponse>;
  courses: PageResponse<CourseResponse>;
  trainings: TrainingResponse[];
  recentCourseEnrollments: PageResponse<EnrollmentResponse>;
  recentTrainingEnrollments: PageResponse<TrainingEnrollmentResponse>;
  recentPosts: PageResponse<ForumPostResponse>;
  commentsCount: ForumCommentsCountResponse;
  topCourses: TopCourseResponse[];
  topTrainings: TopTrainingResponse[];
}

interface StudentInProgressCourse {
  courseId: string;
  title: string;
  image: string | null;
  progressPercentage: number;
}

interface StudentUpcomingSession {
  id: string;
  trainingId: string;
  trainingTitle: string;
  sessionTitle: string;
  startAt: string;
}

interface StudentRecentCertificate {
  id: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
}

interface StudentRecommendedTraining {
  trainingId: string;
  title: string;
  description: string;
  image: string | null;
}

interface StudentWelcomeLoadResult {
  courses: PageResponse<MyCourseResponse>;
  trainings: PageResponse<MyTrainingResponse>;
  upcoming: CalendarEventResponse[];
  certificates: PageResponse<CertificateResponse>;
  trainingCatalog: TrainingResponse[];
  popularTrainings: PopularTrainingResponse[];
}

interface FormateurLoadResult {
  courses: PageResponse<CourseResponse>;
  trainings: TrainingResponse[];
  courseStats: MyCourseStatsResponse;
  trainingStats: MyTrainingStatsResponse;
}

const RECENT_ENROLLMENTS_PAGE_SIZE = 5;
const RECENT_ENROLLMENTS_DISPLAY_LIMIT = 8;
const RECENT_POSTS_PAGE_SIZE = 5;
const TOP_PERFORMERS_FETCH_LIMIT = 5;
const STUDENT_LIST_PAGE_SIZE = 20;
const STUDENT_UPCOMING_EVENTS_LIMIT = 20;
const STUDENT_WIDGET_DISPLAY_LIMIT = 4;
const STUDENT_RECOMMENDED_TRAININGS_LIMIT = 3;

@Component({
  selector: 'app-default',
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    IconDirective,
    SalesReportChartComponent,
    IncomeOverviewChartComponent,
    AnalyticsChartComponent,
    TopPerformersChartComponent,
    TranslatePipe,
    CurrencyDtPipe
  ],
  templateUrl: './default.component.html',
  styleUrls: ['./default.component.scss']
})
export class DefaultComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly adminUserService = inject(AdminUserService);
  private readonly courseService = inject(CourseService);
  private readonly certificateService = inject(CertificateService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly trainingService = inject(TrainingService);
  private readonly trainingEnrollmentService = inject(TrainingEnrollmentService);
  private readonly calendarService = inject(CalendarService);
  private readonly forumService = inject(ForumService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  // currentUser$ can still be null the instant this component initializes on a hard refresh —
  // same rationale as elsewhere in this app (e.g. TrainingFormComponent).
  currentUser: UserProfileResponse | null = null;
  userChecked = false;

  loading = false;
  loadError = '';

  // Cached so onLangChange (see ngOnInit) can rebuild the translated stat cards below without
  // re-fetching from the API — applyDashboardData/applyFormateurData bake .instant() strings
  // straight into stored fields rather than binding them via `| translate`, so a live language
  // switch would otherwise leave these cards frozen in whatever language was active on load.
  private lastDashboardResult: DashboardLoadResult | null = null;
  private lastFormateurResult: FormateurLoadResult | null = null;

  statCards: DashboardStatCard[] = [];
  courseCount = 0;
  trainingCount = 0;
  dailyStats: MergedDailyStat[] = [];
  weeklyRevenueTotal = 0;
  recentEnrollments: RecentEnrollmentRow[] = [];
  recentPosts: ForumPostResponse[] = [];
  commentsCount = 0;
  topPerformers: TopPerformerRow[] = [];

  studentLoading = false;
  studentLoadError = '';
  private studentDataRequested = false;
  inProgressCourses: StudentInProgressCourse[] = [];
  upcomingSessions: StudentUpcomingSession[] = [];
  recentCertificates: StudentRecentCertificate[] = [];
  recommendedTrainings: StudentRecommendedTraining[] = [];

  formateurLoading = false;
  formateurLoadError = '';
  private formateurDataRequested = false;
  formateurStatCards: DashboardStatCard[] = [];
  formateurPerformance: TopPerformerRow[] = [];
  formateurHasNoContent = false;

  readonly formatSessionDate = formatSessionDate;
  readonly formatSessionTime = formatSessionTime;
  readonly formatSessionMonthAbbrev = formatSessionMonthAbbrev;
  readonly formatSessionDayNumber = formatSessionDayNumber;
  readonly getEnrollmentStatusLabel = getEnrollmentStatusLabel;
  readonly getEnrollmentStatusBadgeClass = getEnrollmentStatusBadgeClass;

  constructor() {
    this.iconService.addIcon(
      ...[
        TeamOutline,
        SolutionOutline,
        DollarOutline,
        SafetyCertificateOutline,
        MessageOutline,
        PictureOutline,
        RightOutline,
        ReadOutline,
        ScheduleOutline
      ]
    );
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  get isStudent(): boolean {
    return this.currentUser?.role === 'ETUDIANT';
  }

  get isFormateur(): boolean {
    return this.currentUser?.role === 'FORMATEUR';
  }

  get chartCategories(): string[] {
    return this.dailyStats.map((stat) => formatDashboardDayLabel(stat.date));
  }

  get chartRevenueSeries(): number[] {
    return this.dailyStats.map((stat) => stat.revenue);
  }

  get chartEnrollmentSeries(): number[] {
    return this.dailyStats.map((stat) => stat.count);
  }

  get weeklyRevenueLabel(): string {
    return this.formatCurrency(this.weeklyRevenueTotal);
  }

  get topPerformerLabels(): string[] {
    return this.topPerformers.map((item) => item.title);
  }

  get topPerformerCourseRevenue(): (number | null)[] {
    return this.topPerformers.map((item) => (item.type === 'Course' ? item.revenue : null));
  }

  get topPerformerTrainingRevenue(): (number | null)[] {
    return this.topPerformers.map((item) => (item.type === 'Training' ? item.revenue : null));
  }

  get topPerformerEnrollmentCounts(): number[] {
    return this.topPerformers.map((item) => item.enrollmentCount);
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.userChecked = true;
      this.cdr.markForCheck();

      if (this.isAdmin && this.statCards.length === 0 && !this.loading) {
        this.loadDashboard();
      }

      if (this.isStudent && !this.studentDataRequested) {
        this.studentDataRequested = true;
        this.loadStudentWelcome();
      }

      if (this.isFormateur && !this.formateurDataRequested) {
        this.formateurDataRequested = true;
        this.loadFormateurPerformance();
      }
    });

    // Stat cards below bake translated strings straight into stored fields (see the comment on
    // lastDashboardResult) instead of binding via `| translate`, so a live language switch needs
    // an explicit rebuild from the cached raw data — otherwise they stay frozen in the old language
    // until the next full data reload.
    this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.lastDashboardResult) {
        this.applyDashboardData(this.lastDashboardResult);
      }

      if (this.lastFormateurResult) {
        this.applyFormateurData(this.lastFormateurResult);
      }

      if (this.loadError) {
        this.loadError = this.translateService.instant('dashboard.admin.loadError');
      }

      if (this.studentLoadError) {
        this.studentLoadError = this.translateService.instant('dashboard.student.loadError');
      }

      if (this.formateurLoadError) {
        this.formateurLoadError = this.translateService.instant('dashboard.formateur.loadError');
      }

      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboard(): void {
    this.loading = true;
    this.loadError = '';

    forkJoin({
      userCounts: this.adminUserService.getUserCounts(),
      courseStats: this.enrollmentService.getStats(),
      trainingStats: this.trainingEnrollmentService.getStats(),
      certificates: this.certificateService.listAllCertificates(0, 1),
      courses: this.courseService.getAllCourses('', 0, 1),
      trainings: this.trainingService.getAllTrainings(),
      recentCourseEnrollments: this.enrollmentService.listAllEnrollments(0, RECENT_ENROLLMENTS_PAGE_SIZE),
      recentTrainingEnrollments: this.trainingEnrollmentService.listAllEnrollments(0, RECENT_ENROLLMENTS_PAGE_SIZE),
      recentPosts: this.forumService.listPosts('recent', 0, RECENT_POSTS_PAGE_SIZE),
      commentsCount: this.forumService.getCommentsCount(),
      topCourses: this.enrollmentService.getTopCourses(TOP_PERFORMERS_FETCH_LIMIT, 'revenue'),
      topTrainings: this.trainingEnrollmentService.getTopTrainings(TOP_PERFORMERS_FETCH_LIMIT, 'revenue')
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => this.applyDashboardData(result),
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.loadError = this.translateService.instant('dashboard.admin.loadError');
        }
      });
  }

  loadStudentWelcome(): void {
    this.studentLoading = true;
    this.studentLoadError = '';

    forkJoin({
      courses: this.enrollmentService.getMyCourses(0, STUDENT_LIST_PAGE_SIZE),
      trainings: this.trainingEnrollmentService.listMyTrainings(0, STUDENT_LIST_PAGE_SIZE),
      upcoming: this.calendarService.getUpcoming(STUDENT_UPCOMING_EVENTS_LIMIT),
      certificates: this.certificateService.getMyCertificates(0, STUDENT_LIST_PAGE_SIZE),
      trainingCatalog: this.trainingService.getAllTrainings(),
      popularTrainings: this.trainingEnrollmentService.getPopularTrainings(STUDENT_RECOMMENDED_TRAININGS_LIMIT)
    })
      .pipe(
        finalize(() => {
          this.studentLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => this.applyStudentWelcomeData(result),
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.studentLoadError = this.translateService.instant('dashboard.student.loadError');
        }
      });
  }

  loadFormateurPerformance(): void {
    this.formateurLoading = true;
    this.formateurLoadError = '';

    forkJoin({
      courses: this.courseService.getAllCourses('', 0, 1),
      trainings: this.trainingService.getAllTrainings(),
      courseStats: this.enrollmentService.getMyCourseStats(),
      trainingStats: this.trainingEnrollmentService.getMyTrainingStats()
    })
      .pipe(
        finalize(() => {
          this.formateurLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => this.applyFormateurData(result),
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          this.formateurLoadError = this.translateService.instant('dashboard.formateur.loadError');
        }
      });
  }

  private applyStudentWelcomeData(result: StudentWelcomeLoadResult): void {
    this.inProgressCourses = result.courses.content
      .filter((course) => !course.completed)
      .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))
      .slice(0, STUDENT_WIDGET_DISPLAY_LIMIT)
      .map((course) => ({
        courseId: course.courseId,
        title: course.courseTitle,
        image: course.image,
        progressPercentage: course.progressPercentage
      }));

    // getUpcoming() returns upcoming sessions across every published training (role-scoped, not
    // enrollment-scoped) — narrow to only the trainings this student is actually (still) active in.
    const activeTrainingIds = new Set(
      result.trainings.content.filter((training) => training.status === 'ACTIVE').map((training) => training.trainingId)
    );

    this.upcomingSessions = result.upcoming
      .filter((event) => activeTrainingIds.has(event.trainingId))
      .slice(0, STUDENT_WIDGET_DISPLAY_LIMIT)
      .map((event) => ({
        id: event.id,
        trainingId: event.trainingId,
        trainingTitle: event.trainingTitle,
        sessionTitle: event.sessionTitle,
        startAt: event.startAt
      }));

    this.recentCertificates = result.certificates.content
      .slice()
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      .slice(0, STUDENT_WIDGET_DISPLAY_LIMIT)
      .map((certificate) => ({
        id: certificate.id,
        courseId: certificate.courseId,
        courseTitle: certificate.courseTitle,
        issuedAt: certificate.issuedAt
      }));

    // "Recommended" = the most popular published trainings (by enrollment count, REVOKED
    // included), per GET /stats/popular-trainings — already sorted descending server-side, never
    // re-sorted here. Cross-reference against the already-fetched PUBLISHED catalog to get the
    // full training object (title/description/image); a trainingId with no catalog match (e.g.
    // unpublished after the stats were computed) is naturally dropped rather than shown broken.
    const catalogById = new Map(result.trainingCatalog.map((training) => [training.id, training]));

    this.recommendedTrainings = result.popularTrainings
      .map((popular) => catalogById.get(popular.trainingId))
      .filter((training): training is TrainingResponse => training !== undefined)
      .map((training) => ({
        trainingId: training.id,
        title: training.title,
        description: training.description,
        image: training.image
      }));
  }

  /**
   * courses/trainings counts and the two stats calls are all already scoped server-side to the
   * calling instructor's own content (never client-filtered here) — see
   * CourseService.getAllCourses/TrainingService.getAllTrainings/EnrollmentService.getMyCourseStats/
   * TrainingEnrollmentService.getMyTrainingStats.
   */
  private applyFormateurData(result: FormateurLoadResult): void {
    this.lastFormateurResult = result;
    this.formateurHasNoContent = result.courses.totalElements === 0 && result.trainings.length === 0;

    const totalStudents = result.courseStats.totalCount + result.trainingStats.totalCount;

    this.formateurStatCards = [
      {
        title: this.translateService.instant('dashboard.formateur.myCourses'),
        value: String(result.courses.totalElements),
        icon: 'read',
        colorClass: 'primary',
        subtext: this.translateService.instant('dashboard.formateur.coursesYouOwn')
      },
      {
        title: this.translateService.instant('dashboard.formateur.myTrainings'),
        value: String(result.trainings.length),
        icon: 'schedule',
        colorClass: 'primary',
        subtext: this.translateService.instant('dashboard.formateur.trainingsYouOwn')
      },
      {
        title: this.translateService.instant('dashboard.formateur.totalStudents'),
        value: String(totalStudents),
        icon: 'team',
        colorClass: 'success',
        subtext: this.translateService.instant('dashboard.formateur.courseTrainingBreakdown', {
          courseCount: result.courseStats.totalCount,
          trainingCount: result.trainingStats.totalCount
        })
      }
    ];

    const courseRows: TopPerformerRow[] = result.courseStats.courses.map((course) => ({
      id: course.courseId,
      type: 'Course',
      title: course.courseTitle,
      enrollmentCount: course.enrollmentCount,
      revenue: course.revenue
    }));

    const trainingRows: TopPerformerRow[] = result.trainingStats.trainings.map((training) => ({
      id: training.trainingId,
      type: 'Training',
      title: training.trainingTitle,
      enrollmentCount: training.enrollmentCount,
      revenue: training.revenue
    }));

    this.formateurPerformance = [...courseRows, ...trainingRows].sort((a, b) => b.enrollmentCount - a.enrollmentCount);
  }

  private applyDashboardData(result: DashboardLoadResult): void {
    this.lastDashboardResult = result;
    const totalRevenue = result.courseStats.totalRevenue + result.trainingStats.totalRevenue;
    const totalEnrollments = result.courseStats.totalCount + result.trainingStats.totalCount;

    this.courseCount = result.courses.totalElements;
    this.trainingCount = result.trainings.length;

    this.dailyStats = this.mergeDailyStats(result.courseStats.dailyStats, result.trainingStats.dailyStats);
    this.weeklyRevenueTotal = this.dailyStats.reduce((sum, stat) => sum + stat.revenue, 0);

    this.statCards = [
      {
        title: this.translateService.instant('dashboard.admin.users'),
        value: String(result.userCounts.totalCount),
        icon: 'team',
        colorClass: 'primary',
        subtext: this.translateService.instant('dashboard.admin.usersBreakdown', {
          students: result.userCounts.studentsCount,
          trainers: result.userCounts.trainersCount,
          admins: result.userCounts.adminsCount
        })
      },
      {
        title: this.translateService.instant('dashboard.admin.enrollments'),
        value: String(totalEnrollments),
        icon: 'solution',
        colorClass: 'primary',
        subtext: this.translateService.instant('dashboard.formateur.courseTrainingBreakdown', {
          courseCount: result.courseStats.totalCount,
          trainingCount: result.trainingStats.totalCount
        })
      },
      {
        title: this.translateService.instant('dashboard.admin.revenue'),
        value: this.formatCurrency(totalRevenue),
        icon: 'dollar',
        colorClass: 'warning',
        subtext: this.translateService.instant('dashboard.admin.revenueBreakdown', {
          courseRevenue: this.formatCurrency(result.courseStats.totalRevenue),
          trainingRevenue: this.formatCurrency(result.trainingStats.totalRevenue)
        })
      },
      {
        title: this.translateService.instant('dashboard.admin.certificates'),
        value: String(result.certificates.totalElements),
        icon: 'safety-certificate',
        colorClass: 'success',
        subtext: this.translateService.instant('dashboard.admin.issuedToDate')
      }
    ];

    const courseRows = result.recentCourseEnrollments.content.map((enrollment) => this.mapCourseEnrollment(enrollment));
    const trainingRows = result.recentTrainingEnrollments.content.map((enrollment) => this.mapTrainingEnrollment(enrollment));

    this.recentEnrollments = [...courseRows, ...trainingRows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, RECENT_ENROLLMENTS_DISPLAY_LIMIT);

    this.recentPosts = result.recentPosts.content;
    this.commentsCount = result.commentsCount.count;

    this.topPerformers = this.mergeTopPerformers(result.topCourses, result.topTrainings);
  }

  private mapCourseEnrollment(enrollment: EnrollmentResponse): RecentEnrollmentRow {
    return {
      id: enrollment.id,
      type: 'Course',
      studentName: enrollment.studentName ?? this.translateService.instant('dashboard.admin.unknown'),
      itemTitle: enrollment.courseTitle,
      amount: enrollment.amountAtEnrollment,
      status: enrollment.enrollmentStatus,
      date: enrollment.enrolledAt
    };
  }

  private mapTrainingEnrollment(enrollment: TrainingEnrollmentResponse): RecentEnrollmentRow {
    return {
      id: enrollment.id,
      type: 'Training',
      studentName: enrollment.studentName ?? this.translateService.instant('dashboard.admin.unknown'),
      itemTitle: enrollment.trainingTitle,
      amount: enrollment.amountAtEnrollment,
      status: enrollment.status,
      date: enrollment.enrolledAt
    };
  }

  /** Both services independently zero-fill their own last-7-calendar-days window — merges by date rather than by array index in case the two don't align perfectly. */
  private mergeDailyStats(course: EnrollmentDailyStat[], training: TrainingEnrollmentDailyStat[]): MergedDailyStat[] {
    const merged = new Map<string, MergedDailyStat>();

    for (const stat of course) {
      merged.set(stat.date, { date: stat.date, revenue: stat.revenue, count: stat.count });
    }

    for (const stat of training) {
      const existing = merged.get(stat.date);

      if (existing) {
        existing.revenue += stat.revenue;
        existing.count += stat.count;
      } else {
        merged.set(stat.date, { date: stat.date, revenue: stat.revenue, count: stat.count });
      }
    }

    return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Each service already returns its own top N by revenue, pre-sorted — courses and trainings
   * are two independent pools, not one shared top-N. Keep both lists fully intact (courses
   * first, then trainings) so neither type can crowd the other out; never re-slice the combined
   * array down to a single global limit.
   */
  private mergeTopPerformers(courses: TopCourseResponse[], trainings: TopTrainingResponse[]): TopPerformerRow[] {
    const courseRows: TopPerformerRow[] = courses.map((course) => ({
      id: course.courseId,
      type: 'Course',
      title: course.courseTitle,
      enrollmentCount: course.enrollmentCount,
      revenue: course.revenue
    }));

    const trainingRows: TopPerformerRow[] = trainings.map((training) => ({
      id: training.trainingId,
      type: 'Training',
      title: training.trainingTitle,
      enrollmentCount: training.enrollmentCount,
      revenue: training.revenue
    }));

    return [...courseRows, ...trainingRows];
  }

  private formatCurrency(value: number): string {
    const amount = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
    return `${amount} ${this.translateService.instant('common.currency')}`;
  }
}
