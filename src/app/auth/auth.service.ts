import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, timeout } from 'rxjs/operators';

import {
  AvatarPreset,
  ChangePasswordRequest,
  ForceChangePasswordRequest,
  GoogleSignInRequest,
  MessageResponse,
  SigninRequest,
  SigninResponse,
  SignupRequest,
  SignupResult,
  UpdateProfileRequest,
  UserBasicInfoResponse,
  UserProfileResponse
} from './models/auth.models';

const AUTH_BASE_URL = '/api/auth';
const USERS_BASE_URL = '/api/users';
const AVATARS_BASE_URL = '/api/avatars';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly requestTimeoutMs = 15000;

  private readonly currentUserSubject = new BehaviorSubject<UserProfileResponse | null>(null);
  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  signup(data: SignupRequest): Observable<SignupResult> {
    return this.http.post<SignupResult>(`${AUTH_BASE_URL}/signup`, data, { withCredentials: true }).pipe(timeout(this.requestTimeoutMs));
  }

  signin(data: SigninRequest): Observable<SigninResponse> {
    return this.http.post<SigninResponse>(`${AUTH_BASE_URL}/signin`, data, { withCredentials: true }).pipe(timeout(this.requestTimeoutMs));
  }

  /** Students-only — backend returns 403 if the email is already registered as FORMATEUR/ADMIN. Same response shape and "jwt" cookie as signin(). */
  googleSignIn(idToken: string): Observable<SigninResponse> {
    const data: GoogleSignInRequest = { idToken };

    return this.http.post<SigninResponse>(`${AUTH_BASE_URL}/google`, data, { withCredentials: true }).pipe(timeout(this.requestTimeoutMs));
  }

  verifyEmail(code: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${AUTH_BASE_URL}/verify-email`, { code }, { withCredentials: true }).pipe(timeout(this.requestTimeoutMs));
  }

  resendCode(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${AUTH_BASE_URL}/resend-code`, null, { withCredentials: true }).pipe(timeout(this.requestTimeoutMs));
  }

  logout(): Observable<MessageResponse> {
    return this.http
      .post<MessageResponse>(`${AUTH_BASE_URL}/logout`, null, { withCredentials: true })
      .pipe(
        timeout(this.requestTimeoutMs),
        tap(() => this.currentUserSubject.next(null))
      );
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http
      .post<MessageResponse>(`${AUTH_BASE_URL}/forgot-password`, { email }, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs));
  }

  verifyResetCode(code: string): Observable<MessageResponse> {
    return this.http
      .post<MessageResponse>(`${AUTH_BASE_URL}/verify-reset-code`, { code }, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs));
  }

  resetPassword(newPassword: string, confirmPassword: string): Observable<MessageResponse> {
    return this.http
      .post<MessageResponse>(`${AUTH_BASE_URL}/reset-password`, { newPassword, confirmPassword }, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs));
  }

  /** Any authenticated role can resolve any user id here — used to display e.g. a training's instructor name from its raw instructorId. */
  getUserBasicInfo(id: string): Observable<UserBasicInfoResponse> {
    return this.http
      .get<UserBasicInfoResponse>(`${USERS_BASE_URL}/${id}/basic-info`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs));
  }

  getProfile(): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${USERS_BASE_URL}/me`, { withCredentials: true }).pipe(
      timeout(this.requestTimeoutMs),
      tap((profile) => this.currentUserSubject.next(profile))
    );
  }

  updateProfile(data: UpdateProfileRequest): Observable<UserProfileResponse> {
    return this.http.put<UserProfileResponse>(`${USERS_BASE_URL}/me`, data, { withCredentials: true }).pipe(
      timeout(this.requestTimeoutMs),
      tap((profile) => this.currentUserSubject.next(profile))
    );
  }

  uploadProfileImage(file: File): Observable<UserProfileResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<UserProfileResponse>(`${USERS_BASE_URL}/me/profile-image`, formData, { withCredentials: true }).pipe(
      timeout(this.requestTimeoutMs),
      tap((profile) => this.currentUserSubject.next(profile))
    );
  }

  changePassword(data: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http
      .put<MessageResponse>(`${USERS_BASE_URL}/me/password`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs));
  }

  forceChangePassword(newPassword: string, confirmNewPassword: string): Observable<MessageResponse> {
    const data: ForceChangePasswordRequest = { newPassword, confirmNewPassword };

    return this.http
      .put<MessageResponse>(`${USERS_BASE_URL}/me/force-change-password`, data, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs));
  }

  getAvatarPresets(): Observable<AvatarPreset[]> {
    return this.http
      .get<AvatarPreset[]>(`${AVATARS_BASE_URL}/presets`, { withCredentials: true })
      .pipe(timeout(this.requestTimeoutMs));
  }

  setPresetAvatar(avatarId: string): Observable<UserProfileResponse> {
    return this.http.put<UserProfileResponse>(`${USERS_BASE_URL}/me/profile-image/preset`, { avatarId }, { withCredentials: true }).pipe(
      timeout(this.requestTimeoutMs),
      tap((profile) => this.currentUserSubject.next(profile))
    );
  }
}