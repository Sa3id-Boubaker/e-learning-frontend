import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AuthService } from './auth.service';
import { SigninRequest, SignupRequest, UserProfileResponse } from './models/auth.models';

function makeProfile(overrides: Partial<UserProfileResponse> = {}): UserProfileResponse {
  return {
    id: 'user-1',
    firstName: 'Amir',
    lastName: 'Aydi',
    email: 'amir.aydi@example.com',
    phone: '20000000',
    bio: '',
    profileImage: null,
    role: 'ETUDIANT',
    ...overrides
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('signin() posts the credentials to /api/auth/signin with credentials included', () => {
    const data: SigninRequest = { email: 'amir.aydi@example.com', password: 'secret' };
    service.signin(data).subscribe();

    const req = httpMock.expectOne('/api/auth/signin');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    expect(req.request.withCredentials).toBe(true);
    req.flush(makeProfile());
  });

  it('signup() posts the registration payload to /api/auth/signup', () => {
    const data: SignupRequest = { firstName: 'Amir', lastName: 'Aydi', email: 'amir.aydi@example.com', password: 'secret', phone: '20000000' };
    service.signup(data).subscribe();

    const req = httpMock.expectOne('/api/auth/signup');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush(makeProfile());
  });

  it('googleSignIn() posts { idToken } to /api/auth/google', () => {
    service.googleSignIn('a-google-id-token').subscribe();

    const req = httpMock.expectOne('/api/auth/google');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idToken: 'a-google-id-token' });
    req.flush(makeProfile());
  });

  it('getProfile() fetches /api/users/me and publishes the result on currentUser$', () => {
    const profile = makeProfile();
    let latest: UserProfileResponse | null = null;
    service.currentUser$.subscribe((value) => (latest = value));

    expect(latest).toBeNull();

    service.getProfile().subscribe();
    httpMock.expectOne('/api/users/me').flush(profile);

    expect(latest).toEqual(profile);
  });

  it('updateProfile() also republishes the updated profile on currentUser$', () => {
    let latest: UserProfileResponse | null = null;
    service.currentUser$.subscribe((value) => (latest = value));

    const updated = makeProfile({ firstName: 'Updated' });
    service.updateProfile({ firstName: 'Updated' }).subscribe();

    const req = httpMock.expectOne('/api/users/me');
    expect(req.request.method).toBe('PUT');
    req.flush(updated);

    expect(latest).toEqual(updated);
  });

  it('logout() clears currentUser$ back to null after a prior sign-in', () => {
    let latest: UserProfileResponse | null = null;
    service.currentUser$.subscribe((value) => (latest = value));

    service.getProfile().subscribe();
    httpMock.expectOne('/api/users/me').flush(makeProfile());
    expect(latest).not.toBeNull();

    service.logout().subscribe();
    httpMock.expectOne('/api/auth/logout').flush({ message: 'logged out' });

    expect(latest).toBeNull();
  });

  it('forgotPassword() posts { email } to /api/auth/forgot-password', () => {
    service.forgotPassword('amir.aydi@example.com').subscribe();

    const req = httpMock.expectOne('/api/auth/forgot-password');
    expect(req.request.body).toEqual({ email: 'amir.aydi@example.com' });
    req.flush({ message: 'sent' });
  });

  it('getUserBasicInfo(id) fetches /api/users/:id/basic-info', () => {
    service.getUserBasicInfo('user-42').subscribe();

    const req = httpMock.expectOne('/api/users/user-42/basic-info');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'user-42', firstName: 'A', lastName: 'B', email: 'a@b.com', profileImage: null, role: 'ETUDIANT' });
  });
});
