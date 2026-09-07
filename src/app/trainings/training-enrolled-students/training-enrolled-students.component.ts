import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { formatSessionDate } from '../format-session-date-time';
import { getTrainingEnrollmentStatusBadgeClass, getTrainingEnrollmentStatusLabel } from '../training-enrollment-status';
import { TrainingService } from '../training.service';
import { TrainingEnrollmentService } from '../training-enrollment.service';
import { TrainingResponse } from '../models/training.models';
import { TrainingEnrollmentResponse } from '../models/training-enrollment.models';

@Component({
  selector: 'app-training-enrolled-students',
  imports: [SharedModule, RouterLink],
  templateUrl: './training-enrolled-students.component.html',
  styleUrl: './training-enrolled-students.component.scss'
})
export class TrainingEnrolledStudentsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly trainingService = inject(TrainingService);
  private readonly trainingEnrollmentService = inject(TrainingEnrollmentService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;

  loading = true;
  notFound = false;
  accessDenied = false;
  loadError = '';

  training: TrainingResponse | null = null;
  enrollments: TrainingEnrollmentResponse[] = [];

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  private trainingId = '';

  readonly getTrainingEnrollmentStatusLabel = getTrainingEnrollmentStatusLabel;
  readonly getTrainingEnrollmentStatusBadgeClass = getTrainingEnrollmentStatusBadgeClass;
  readonly formatSessionDate = formatSessionDate;

  get pageStart(): number {
    return this.totalElements === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 0;
  }

  get hasNextPage(): boolean {
    return this.currentPage + 1 < this.totalPages;
  }

  ngOnInit(): void {
    this.trainingId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadTraining();
  }

  loadTraining(): void {
    if (!this.trainingId) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    this.loading = true;
    this.loadError = '';
    this.notFound = false;
    this.accessDenied = false;

    this.trainingService.getTrainingById(this.trainingId).subscribe({
      next: (training) => {
        this.training = training;
        this.loadEnrollments();
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

        if (status === 403) {
          this.accessDenied = true;
          this.cdr.markForCheck();
          return;
        }

        this.loadError = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('trainings.detail.loadError');
        this.cdr.markForCheck();
      }
    });
  }

  loadEnrollments(): void {
    this.loading = true;
    this.loadError = '';
    this.accessDenied = false;

    this.trainingEnrollmentService.listAllEnrollments(this.currentPage, this.pageSize, { trainingId: this.trainingId }).subscribe({
      next: (result) => {
        this.loading = false;
        this.enrollments = result.content;
        this.currentPage = result.page;
        this.totalElements = result.totalElements;
        this.totalPages = result.totalPages;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        const status = error?.status as number | undefined;

        if (status === 401) {
          this.cdr.markForCheck();
          return;
        }

        if (status === 403) {
          this.accessDenied = true;
          this.cdr.markForCheck();
          return;
        }

        this.loadError =
          (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.enrolledStudents.loadError');
        this.cdr.markForCheck();
      }
    });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadEnrollments();
    this.scrollTableToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadEnrollments();
    this.scrollTableToTop();
  }

  private scrollTableToTop(): void {
    this.tableContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
