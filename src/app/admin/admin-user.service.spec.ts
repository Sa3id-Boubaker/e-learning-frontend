import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ToastService } from '../theme/shared/components/toast/toast.service';
import { AdminUserService } from './admin-user.service';
import { AdminUserResponse, PageResponse } from './models/admin-user.models';

function makePage(): PageResponse<AdminUserResponse> {
  return {
    content: [],
    page: 0,
    size: 5,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true
  };
}

describe('AdminUserService', () => {
  let service: AdminUserService;
  let httpMock: HttpTestingController;
  let toastService: { error: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toastService = { error: vi.fn() };
    router = { navigateByUrl: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router }
      ]
    });

    service = TestBed.inject(AdminUserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listStudents() calls GET /api/admin/students with page/size/search query params, with credentials', () => {
    service.listStudents(0, 5, 'amir').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/admin/students' && r.params.get('page') === '0' && r.params.get('size') === '5' && r.params.get('search') === 'amir'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush(makePage());
  });

  it('listTrainers() calls GET /api/admin/trainers with the same query params', () => {
    service.listTrainers(1, 10, '').subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/admin/trainers' && r.params.get('page') === '1' && r.params.get('size') === '10');
    expect(req.request.method).toBe('GET');
    req.flush(makePage());
  });

  it('getUserCounts() calls GET /api/admin/users/counts', () => {
    service.getUserCounts().subscribe();

    const req = httpMock.expectOne('/api/admin/users/counts');
    expect(req.request.method).toBe('GET');
    req.flush({ studentsCount: 1, trainersCount: 2, adminsCount: 3, totalCount: 6 });
  });

  it('createUser() posts to /api/admin/users with the given payload', () => {
    const payload = { firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '20000000', role: 'ETUDIANT' as const };
    service.createUser(payload).subscribe();

    const req = httpMock.expectOne('/api/admin/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('updateUser() puts to /api/admin/users/:id', () => {
    service.updateUser('user-1', { firstName: 'New' }).subscribe();

    const req = httpMock.expectOne('/api/admin/users/user-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ firstName: 'New' });
    req.flush({});
  });

  it('deleteUser() deletes /api/admin/users/:id', () => {
    service.deleteUser('user-1').subscribe();

    const req = httpMock.expectOne('/api/admin/users/user-1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'deleted' });
  });

  it('on a 401 response: shows a toast and redirects to /login, and still re-throws the error to the caller', () => {
    let observedError: unknown;
    service.getUserCounts().subscribe({ error: (err) => (observedError = err) });

    httpMock.expectOne('/api/admin/users/counts').flush({ message: 'Session expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(toastService.error).toHaveBeenCalledWith('Session expired');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(observedError).toBeTruthy();
  });

  it('on a 403 response: shows a toast and redirects to /dashboard/default', () => {
    service.getUserCounts().subscribe({ error: () => undefined });

    httpMock.expectOne('/api/admin/users/counts').flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(toastService.error).toHaveBeenCalledWith('Forbidden');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard/default');
  });

  it('on a 401 with no message from the backend, falls back to a default message', () => {
    service.getUserCounts().subscribe({ error: () => undefined });

    httpMock.expectOne('/api/admin/users/counts').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(toastService.error).toHaveBeenCalledWith('Authentication required. Please sign in.');
  });

  it('on any other status (e.g. 404): does not toast or redirect, but still re-throws so the caller can react', () => {
    let observedError: unknown;
    service.getUserCounts().subscribe({ error: (err) => (observedError = err) });

    httpMock.expectOne('/api/admin/users/counts').flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    expect(toastService.error).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(observedError).toBeTruthy();
  });
});
