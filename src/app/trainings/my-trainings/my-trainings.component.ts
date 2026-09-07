import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { PictureOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { formatSessionDate } from '../format-session-date-time';
import { getTrainingEnrollmentStatusBadgeClass, getTrainingEnrollmentStatusLabel } from '../training-enrollment-status';
import { MyTrainingResponse } from '../models/training-enrollment.models';
import { TrainingEnrollmentService } from '../training-enrollment.service';

@Component({
  selector: 'app-my-trainings',
  imports: [SharedModule, RouterLink],
  templateUrl: './my-trainings.component.html',
  styleUrl: './my-trainings.component.scss'
})
export class MyTrainingsComponent implements OnInit, OnDestroy {
  private readonly trainingEnrollmentService = inject(TrainingEnrollmentService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('gridContainer') gridContainer?: ElementRef<HTMLElement>;

  // Same rationale as elsewhere in this app (StudentCourseLibraryComponent, CourseDetailComponent):
  // currentUser$ can still be at its initial `null` the instant this component initializes on a
  // hard refresh, so this is a live subscription guarded by an idempotent dataRequested flag
  // rather than a one-shot read.
  accessChecked = false;
  isStudent = false;
  private dataRequested = false;

  trainings: MyTrainingResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  readonly getTrainingEnrollmentStatusLabel = getTrainingEnrollmentStatusLabel;
  readonly getTrainingEnrollmentStatusBadgeClass = getTrainingEnrollmentStatusBadgeClass;
  readonly formatSessionDate = formatSessionDate;

  constructor() {
    this.iconService.addIcon(...[PictureOutline]);
  }

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
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.isStudent = user?.role === 'ETUDIANT';
      this.accessChecked = true;

      if (this.isStudent && !this.dataRequested) {
        this.dataRequested = true;
        this.loadTrainings();
      }

      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTrainings(): void {
    this.loading = true;
    this.loadError = '';

    this.trainingEnrollmentService.listMyTrainings(this.currentPage, this.pageSize).subscribe({
      next: (result) => {
        this.loading = false;
        this.trainings = result.content;
        this.currentPage = result.page;
        this.totalElements = result.totalElements;
        this.totalPages = result.totalPages;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        this.cdr.markForCheck();

        const status = error?.status as number | undefined;

        if (status === 401) {
          return;
        }

        this.loadError =
          (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('trainings.myTrainings.loadError');
      }
    });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadTrainings();
    this.scrollGridToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadTrainings();
    this.scrollGridToTop();
  }

  openTraining(training: MyTrainingResponse): void {
    void this.router.navigateByUrl(`/trainings/${training.trainingId}`);
  }

  private scrollGridToTop(): void {
    this.gridContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
