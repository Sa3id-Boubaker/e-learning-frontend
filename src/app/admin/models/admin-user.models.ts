import { Role } from '../../auth/models/auth.models';

export type AdminManagedRole = Extract<Role, 'ETUDIANT' | 'FORMATEUR'>;

export interface AdminUserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string | null;
  profileImage: string | null;
  role: AdminManagedRole;
  enabled: boolean;
  createdAt: string;
}

export interface CreateUserByAdminRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: AdminManagedRole;
}

export interface AdminUpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  profileImage?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface UserCounts {
  studentsCount: number;
  trainersCount: number;
  adminsCount: number;
  totalCount: number;
}
