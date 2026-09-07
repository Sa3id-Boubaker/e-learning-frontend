import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Client-side PDF generation for a rendered certificate — no backend involvement, no print
 * dialog. Shared by CertificateViewComponent and CertificateVerifyComponent.
 */
@Injectable({
  providedIn: 'root'
})
export class CertificatePdfService {
  async downloadCertificatePdf(element: HTMLElement, certificateNumber: string): Promise<void> {
    // Without this, html2canvas can fire before the Playfair Display webfont finishes loading,
    // silently falling back to a system serif for the title/name — wait for the browser's own
    // signal that every requested font face is actually ready to paint.
    await document.fonts.ready;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const imageData = canvas.toDataURL('image/png');
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [canvas.width, canvas.height]
    });

    pdf.addImage(imageData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`Omarise-Certificate-${certificateNumber}.pdf`);
  }
}
