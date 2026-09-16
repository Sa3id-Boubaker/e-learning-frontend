import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = new ToastService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('success()/error()/info()/warning() each add a toast of the matching type with the given message', () => {
    service.success('Enrollment created');
    service.error('Something went wrong');
    service.info('Heads up');
    service.warning('Careful');

    const types = service.toasts().map((t) => t.type);
    expect(types).toContain('success');
    expect(types).toContain('error');
    expect(types).toContain('info');
    expect(types).toContain('warning');

    const successToast = service.toasts().find((t) => t.type === 'success');
    expect(successToast?.message).toBe('Enrollment created');
  });

  it('prepends new toasts so the most recent one is first', () => {
    service.success('first');
    service.success('second');

    expect(service.toasts().map((t) => t.message)).toEqual(['second', 'first']);
  });

  it('assigns each toast a distinct, increasing id', () => {
    service.success('a');
    service.success('b');

    const [newer, older] = service.toasts();
    expect(newer.id).toBeGreaterThan(older.id);
  });

  it('dismiss() removes only the targeted toast', () => {
    service.success('keep me');
    service.success('remove me');
    const [toRemove, toKeep] = service.toasts();

    service.dismiss(toRemove.id);

    expect(service.toasts()).toEqual([toKeep]);
  });

  it('auto-dismisses a success/info/warning toast after 4s', () => {
    vi.useFakeTimers();
    service.success('will vanish');
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(3999);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('auto-dismisses an error toast after 6s, not 4s', () => {
    vi.useFakeTimers();
    service.error('will vanish later');

    vi.advanceTimersByTime(4000);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(service.toasts().length).toBe(0);
  });

  it('dismiss() before the auto-dismiss timer fires cancels that timer (no double-removal error)', () => {
    vi.useFakeTimers();
    service.success('manually dismissed');
    const [toast] = service.toasts();

    service.dismiss(toast.id);
    expect(() => vi.advanceTimersByTime(4000)).not.toThrow();
    expect(service.toasts()).toEqual([]);
  });
});
