export type Role = 'ADMIN' | 'FORMATEUR' | 'ETUDIANT';

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  phone: string;
  enabled: boolean;
  createdAt: string;
  mustChangePassword: boolean;
}

// The backend authenticates purely via an httpOnly cookie — signup/signin responses are
// the UserResponse object itself, with no token/user wrapper.
export type SignupResult = UserResponse;
export type SigninResponse = UserResponse;

export interface MessageResponse {
  message: string;
}

export interface SignupRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
}

export interface SigninRequest {
  email: string;
  password: string;
}

export interface GoogleSignInRequest {
  idToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  code: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
  confirmPassword: string;
}

export interface UserBasicInfoResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string | null;
  role: Role;
}

export interface UserProfileResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  profileImage: string | null;
  role?: Role;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ForceChangePasswordRequest {
  newPassword: string;
  confirmNewPassword: string;
}

export interface AvatarPreset {
  id: string;
  url: string;
}

export interface ApiErrorResponse {
  timestamp?: string;
  status?: number;
  message?: string;
  errors?: Record<string, string>;
}