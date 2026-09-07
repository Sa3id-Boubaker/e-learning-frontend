import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconService } from '@ant-design/icons-angular';
import { SafetyCertificateOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { SharedModule } from '../../theme/shared/shared.module';
import { CertificateService } from '../certificate.service';
import { CertificateResponse } from '../models/certificate.models';

@Component({
  selector: 'app-my-certificates',
  imports: [SharedModule, RouterLink],
  templateUrl: './my-certificates.component.html',
  styleUrl: './my-certificates.component.scss'
})
export class MyCertificatesComponent implements OnInit {
  private readonly certificateService = inject(CertificateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @ViewChild('gridContainer') gridContainer?: ElementRef<HTMLElement>;

  certificates: CertificateResponse[] = [];
  loading = false;
  loadError = '';

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

  ngOnInit(): void {
    this.loadCertificates();
  }

  loadCertificates(): void {
    this.loading = true;
    this.loadError = '';

    this.certificateService.getMyCertificates(this.currentPage, this.pageSize).subscribe({
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

        this.loadError = this.translateService.instant('courses.myCertificates.loadError');
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
    this.scrollGridToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadCertificates();
    this.scrollGridToTop();
  }

  private scrollGridToTop(): void {
    this.gridContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
