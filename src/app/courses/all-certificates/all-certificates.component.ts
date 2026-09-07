import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { SafetyCertificateOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { CertificateService } from '../certificate.service';
import { CertificateResponse } from '../models/certificate.models';

@Component({
  selector: 'app-all-certificates',
  imports: [SharedModule],
  templateUrl: './all-certificates.component.html',
  styleUrl: './all-certificates.component.scss'
})
export class AllCertificatesComponent implements OnInit, OnDestroy {
  private readonly certificateService = inject(CertificateService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;

  // Same rationale as elsewhere in this app (CourseDetailComponent, QuizPageComponent):
  // currentUser$ can still be at its initial `null` the instant this component initializes on
  // a hard refresh, since the real profile is fetched asynchronously by the nav bar rather than
  // a route guard — so this is a live subscription, not a one-shot read, and dataRequested
  // guards against fetching twice regardless of how many times it fires.
  accessChecked = false;
  isAdmin = false;
  private dataRequested = false;

  loading = false;
  loadError = '';
  certificates: CertificateResponse[] = [];

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

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
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.isAdmin = user?.role === 'ADMIN';
      this.accessChecked = true;

      if (this.isAdmin && !this.dataRequested) {
        this.dataRequested = true;
        this.loadCertificates();
      }

      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCertificates(): void {
    this.loading = true;
    this.loadError = '';

    this.certificateService.listAllCertificates(this.currentPage, this.pageSize).subscribe({
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
