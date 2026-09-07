import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { PictureOutline, SearchOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { CourseService } from '../course.service';
import { CourseResponse } from '../models/course.models';
import { PriceDisplayComponent } from '../price-display/price-display.component';

const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-courses-list',
  imports: [SharedModule, PriceDisplayComponent],
  templateUrl: './courses-list.component.html',
  styleUrl: './courses-list.component.scss'
})
export class CoursesListComponent implements OnInit, OnDestroy {
  private readonly courseService = inject(CourseService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('gridContainer') gridContainer?: ElementRef<HTMLElement>;

  courses: CourseResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  readonly searchControl = new FormControl('', { nonNullable: true });
  searchTerm = '';
  searching = false;

  constructor() {
    this.iconService.addIcon(...[PictureOutline, SearchOutline]);

    this.searchControl.valueChanges.pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe((term) => {
      this.searchTerm = term;
      this.currentPage = 0;
      this.loadCourses({ isSearch: true });
    });
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
    this.loadCourses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCourses(options: { isSearch?: boolean } = {}): void {
    const isSearch = options.isSearch === true;

    if (isSearch) {
      this.searching = true;
    } else {
      this.loading = true;
      this.loadError = '';
    }

    this.courseService
      .getAllCourses(this.searchTerm, this.currentPage, this.pageSize)
      .pipe(
        finalize(() => {
          if (isSearch) {
            this.searching = false;
          } else {
            this.loading = false;
          }
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.courses = result.content;
          this.currentPage = result.page;
          this.totalElements = result.totalElements;
          this.totalPages = result.totalPages;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const message =
            (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.list.loadError');

          if (isSearch) {
            this.toastService.error(message);
          } else {
            this.loadError = message;
          }
        }
      });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadCourses();
    this.scrollGridToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadCourses();
    this.scrollGridToTop();
  }

  openCourse(course: CourseResponse): void {
    void this.router.navigateByUrl(`/courses/${course.id}`);
  }

  private scrollGridToTop(): void {
    this.gridContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
