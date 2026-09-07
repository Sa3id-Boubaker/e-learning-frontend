import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { IconService } from '@ant-design/icons-angular';
import { CheckCircleOutline, CloseCircleOutline, FilePdfOutline, SafetyCertificateOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { CertificateCardComponent } from '../certificate-card/certificate-card.component';
import { CertificatePdfService } from '../certificate-pdf.service';
import { CertificateService } from '../certificate.service';
import { CertificateResponse } from '../models/certificate.models';

/**
 * Fully public page — no navbar/sidebar assumptions, works for a signed-out visitor (e.g. an
 * employer checking a certificate). Routed under GuestLayoutComponent, not AdminLayout, and
 * CertificateService.verifyCertificate() deliberately never redirects to /login on error.
 */
@Component({
  selector: 'app-certificate-verify',
  imports: [SharedModule, CertificateCardComponent],
  templateUrl: './certificate-verify.component.html',
  styleUrl: './certificate-verify.component.scss'
})
export class CertificateVerifyComponent implements OnInit {
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
  notFound = false;
  loadError = '';
  certificate: CertificateResponse | null = null;
  generatingPdf = false;

  private certificateNumber = '';

  constructor() {
    this.iconService.addIcon(...[CheckCircleOutline, CloseCircleOutline, SafetyCertificateOutline, FilePdfOutline]);
  }

  ngOnInit(): void {
    this.certificateNumber = this.route.snapshot.paramMap.get('certificateNumber') ?? '';
    this.loadCertificate();
  }

  loadCertificate(): void {
    if (!this.certificateNumber) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    this.loading = true;
    this.loadError = '';
    this.notFound = false;

    this.certificateService.verifyCertificate(this.certificateNumber).subscribe({
      next: (certificate) => {
        this.loading = false;
        this.certificate = certificate;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        const status = error?.status as number | undefined;

        if (status === 404) {
          this.notFound = true;
          this.cdr.markForCheck();
          return;
        }

        this.loadError = this.translateService.instant('courses.certificateVerify.loadError');
        this.cdr.markForCheck();
      }
    });
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
