export interface CertificateResponse {
  id: string;
  certificateNumber: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  instructorName: string;
  quizScore: number;
  issuedAt: string;
  status: 'ISSUED' | 'REVOKED';
  // Present only in admin/formateur contexts — never for the student/public endpoints this
  // app currently uses. Genuinely absent from the JSON, not null.
  studentId?: string;
  instructorId?: string;
  // Nullable even when present — older certificates or users who never set an avatar keep
  // falling back to an initials circle, same as elsewhere in this app.
  studentProfileImage?: string | null;
  instructorProfileImage?: string | null;
}
