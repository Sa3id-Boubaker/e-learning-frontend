import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { IconService } from '@ant-design/icons-angular';
import { SafetyCertificateOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { CertificateService } from '../certificate.service';
import { CourseService } from '../course.service';
import { CertificateResponse } from '../models/certificate.models';
import { CourseResponse } from '../models/course.models';

@Component({
  selector: 'app-course-certificates',
  imports: [SharedModule, RouterLink],
  templateUrl: './course-certificates.component.html',
  styleUrl: './course-certificates.component.scss'
})
export class CourseCertificatesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly courseService = inject(CourseService);
  private readonly certificateService = inject(CertificateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;

  loading = true;
  notFound = false;
  accessDenied = false;
  loadError = '';

  course: CourseResponse | null = null;
  certificates: CertificateResponse[] = [];

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  private courseId = '';

  constructor() {
    this.iconService.addIcon(...[SafetyCertificateOutline]);
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

  initialsFor(studentName: string): string {
    const parts = studentName.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return '?';
    }

    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';

    return `${first}${last}`.toUpperCase() || '?';
  }

  ngOnInit(): void {
    this.courseId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadCourse();
  }

  loadCourse(): void {
    if (!this.courseId) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    this.loading = true;
    this.loadError = '';
    this.notFound = false;
    this.accessDenied = false;

    this.courseService.getCourseById(this.courseId).subscribe({
      next: (course) => {
        this.course = course;
        this.loadCertificates();
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

  loadCertificates(): void {
    this.loading = true;
    this.loadError = '';
    this.accessDenied = false;

    this.certificateService.listCertificatesByCourse(this.courseId, this.currentPage, this.pageSize).subscribe({
      next: (result) => {
        this.loading = false;
        this.certificates = result.content;
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
          (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('courses.allCertificates.loadError');
        this.cdr.markForCheck();
      }
    });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadCertificates();
    this.scrollTableToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadCertificates();
    this.scrollTableToTop();
  }

  private scrollTableToTop(): void {
    this.tableContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
