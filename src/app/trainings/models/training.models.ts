export type TrainingStatus = 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TrainingResponse {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPercentage: number;
  finalPrice: number;
  image: string | null;
  createdBy: string | null;
  instructorId: string;
  status: TrainingStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingCreateRequest {
  title: string;
  description: string;
  price: number;
  discountPercentage?: number;
  startDate: string;
  endDate: string;
  status?: TrainingStatus;
  image?: File;
  /** Required when the creator is ADMIN, ignored server-side when the creator is FORMATEUR. */
  instructorId?: string;
}

export interface TrainingUpdateRequest {
  title?: string;
  description?: string;
  price?: number;
  discountPercentage?: number;
  startDate?: string;
  endDate?: string;
  status?: TrainingStatus;
  /** ADMIN-only reassignment — rejected by the backend if sent by a non-admin. */
  instructorId?: string;
}

/** Anonymous-safe — GET /api/trainings/public, no auth required. No instructor/description/status/timestamps. For the public landing page only. */
export interface PublicTrainingResponse {
  id: string;
  title: string;
  image: string | null;
  price: number;
  finalPrice: number;
  startDate: string;
}

/** Preview of what DELETE /api/trainings/{id} would cascade-delete — fetched before showing the delete confirmation. */
export interface TrainingDeletionImpactResponse {
  trainingId: string;
  liveSessionCount: number;
  recordingCount: number;
  totalEnrollmentCount: number;
  activeEnrollmentCount: number;
}
