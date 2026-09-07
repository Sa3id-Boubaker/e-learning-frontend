import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { IconService } from '@ant-design/icons-angular';
import { CopyOutline, FilePdfOutline, SafetyCertificateOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { CertificateCardComponent } from '../certificate-card/certificate-card.component';
import { CertificatePdfService } from '../certificate-pdf.service';
import { CertificateService } from '../certificate.service';
import { CertificateResponse } from '../models/certificate.models';

@Component({
  selector: 'app-certificate-view',
  imports: [SharedModule, RouterLink, CertificateCardComponent],
  templateUrl: './certificate-view.component.html',
  styleUrl: './certificate-view.component.scss'
})
export class CertificateViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly certificateService = inject(CertificateService);
  private readonly certificatePdfService = inject(CertificatePdfService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  // Wraps <app-certificate-card>: that component's host is `display: contents` (no box of its
  // own), so html2canvas needs this wrapper's real DOM box to capture, not the child directly.
  @ViewChild('certificateCapture') certificateCaptureRef?: ElementRef<HTMLElement>;

  loading = true;
  notEarned = false;
  loadError = '';
  certificate: CertificateResponse | null = null;
  generatingPdf = false;

  courseId = '';

  constructor() {
    this.iconService.addIcon(...[SafetyCertificateOutline, CopyOutline, FilePdfOutline]);
  }

  get verificationUrl(): string {
    if (!this.certificate) {
      return '';
    }

    return `${window.location.origin}/certificates/verify/${this.certificate.certificateNumber}`;
  }

  ngOnInit(): void {
    this.courseId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadCertificate();
  }

  loadCertificate(): void {
    if (!this.courseId) {
      this.notEarned = true;
      this.loading = false;
      return;
    }

    this.loading = true;
    this.loadError = '';
    this.notEarned = false;

    this.certificateService.getMyCertificateForCourse(this.courseId).subscribe({
      next: (certificate) => {
        this.loading = false;
        this.certificate = certificate;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        const status = error?.status as number | undefined;

        if (status === 404) {
          this.notEarned = true;
          this.cdr.markForCheck();
          return;
        }

        if (status === 401) {
          this.cdr.markForCheck();
          return;
        }

        this.loadError = this.translateService.instant('courses.certificateView.loadError');
        this.cdr.markForCheck();
      }
    });
  }

  copyVerificationLink(): void {
    if (!this.certificate) {
      return;
    }

    navigator.clipboard
      .writeText(this.verificationUrl)
      .then(() => this.toastService.success(this.translateService.instant('courses.certificateView.linkCopied')))
      .catch(() => this.toastService.error(this.translateService.instant('courses.certificateView.copyError')));
  }

  async downloadPdf(): Promise<void> {
    if (!this.certificate || !this.certificateCaptureRef || this.generatingPdf) {
      return;
    }

    this.generatingPdf = true;
    this.cdr.markForCheck();

    try {
      await this.certificatePdfService.downloadCertificatePdf(this.certificateCaptureRef.nativeElement, this.certificate.certificateNumber);
    } catch {
      this.toastService.error(this.translateService.instant('courses.certificateView.pdfError'));
    } finally {
      this.generatingPdf = false;
      this.cdr.markForCheck();
    }
  }
}
