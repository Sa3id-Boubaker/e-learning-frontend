import { FormControl } from '@angular/forms';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Observable, of, throwError } from 'rxjs';

import { AdminUserResponse } from './models/admin-user.models';
import { EnrollmentSubmitHost, StudentSearchFormBase, StudentSearchHost, pickStudent, submitEnrollment } from './student-selection';

function makeStudent(overrides: Partial<AdminUserResponse> = {}): AdminUserResponse {
  return {
    id: 'student-1',
    firstName: 'Amir',
    lastName: 'Aydi',
    email: 'amir.aydi@example.com',
    phone: '20000000',
    bio: null,
    profileImage: null,
    role: 'ETUDIANT',
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeSearchHost(): StudentSearchHost {
  return {
    selectedStudent: null,
    studentSearchControl: new FormControl('', { nonNullable: true }),
    studentResultsOpen: true,
    studentResults: [makeStudent({ id: 'student-2' }), makeStudent({ id: 'student-3' })]
  };
}

describe('pickStudent', () => {
  it('sets selectedStudent, fills the search field with the full name, and closes the results list', () => {
    const host = makeSearchHost();
    const student = makeStudent();

    pickStudent(host, student);

    expect(host.selectedStudent).toBe(student);
    expect(host.studentSearchControl.value).toBe('Amir Aydi');
    expect(host.studentResultsOpen).toBe(false);
    expect(host.studentResults).toEqual([]);
  });

  it('fills the search field without re-triggering the debounced search (emitEvent: false)', () => {
    const host = makeSearchHost();
    const valueChanges = vi.fn();
    host.studentSearchControl.valueChanges.subscribe(valueChanges);

    pickStudent(host, makeStudent());

    expect(valueChanges).not.toHaveBeenCalled();
  });
});

describe('StudentSearchFormBase', () => {
  class TestHost extends StudentSearchFormBase implements StudentSearchHost {
    selectedStudent: AdminUserResponse | null = null;
    readonly studentSearchControl = new FormControl('', { nonNullable: true });
    studentResultsOpen = true;
    studentResults: AdminUserResponse[] = [makeStudent()];
  }

  it('selectStudent() delegates to pickStudent() using the instance itself as the host', () => {
    const host = new TestHost();
    const student = makeStudent({ firstName: 'Sonia', lastName: 'Ben Ali' });

    host.selectStudent(student);

    expect(host.selectedStudent).toBe(student);
    expect(host.studentSearchControl.value).toBe('Sonia Ben Ali');
    expect(host.studentResultsOpen).toBe(false);
    expect(host.studentResults).toEqual([]);
  });
});

describe('submitEnrollment', () => {
  let host: EnrollmentSubmitHost<{ id: string }>;
  let createEnrollment: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    host = {
      canSubmit: true,
      selectedStudent: makeStudent(),
      serverMessage: 'stale error from a previous attempt',
      submitting: false,
      created: { emit: vi.fn() },
      cdr: { markForCheck: vi.fn() } as unknown as EnrollmentSubmitHost<{ id: string }>['cdr'],
      handleCreateError: vi.fn()
    };
    createEnrollment = vi.fn();
  });

  it('does nothing and never calls createEnrollment when the form cannot be submitted', () => {
    const guardedHost = { ...host, canSubmit: false };

    submitEnrollment(guardedHost, createEnrollment as unknown as (studentId: string) => Observable<{ id: string }>);

    expect(createEnrollment).not.toHaveBeenCalled();
    expect(guardedHost.submitting).toBe(false);
  });

  it('does nothing when canSubmit is true but no student is selected', () => {
    const guardedHost = { ...host, selectedStudent: null };

    submitEnrollment(guardedHost, createEnrollment as unknown as (studentId: string) => Observable<{ id: string }>);

    expect(createEnrollment).not.toHaveBeenCalled();
  });

  it('on success: resets serverMessage, sets submitting, calls the service with the selected student id, then emits created and clears submitting', () => {
    const result = { id: 'enrollment-1' };
    createEnrollment.mockReturnValue(of(result));

    submitEnrollment(host, createEnrollment as unknown as (studentId: string) => Observable<{ id: string }>);

    expect(createEnrollment).toHaveBeenCalledWith('student-1');
    expect(host.serverMessage).toBe('');
    expect(host.created.emit).toHaveBeenCalledWith(result);
    expect(host.handleCreateError).not.toHaveBeenCalled();
    // finalize() runs after next/error, so submitting is reset back to false once the call completes.
    expect(host.submitting).toBe(false);
    expect(host.cdr.markForCheck).toHaveBeenCalled();
  });

  it('on error: routes to handleCreateError instead of created.emit, and still clears submitting via finalize', () => {
    const error = { status: 409 };
    createEnrollment.mockReturnValue(throwError(() => error));

    submitEnrollment(host, createEnrollment as unknown as (studentId: string) => Observable<{ id: string }>);

    expect(host.handleCreateError).toHaveBeenCalledWith(error);
    expect(host.created.emit).not.toHaveBeenCalled();
    expect(host.submitting).toBe(false);
    expect(host.cdr.markForCheck).toHaveBeenCalled();
  });
});
