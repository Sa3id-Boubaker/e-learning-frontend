import { Injectable, Signal, signal } from '@angular/core';

/** Once shown, the indicator stays visible at least this long so fast requests don't just flash. */
const MIN_VISIBLE_DURATION_MS = 400;

/**
 * Tracks in-flight HTTP requests as a counter (not a boolean) so overlapping requests
 * don't hide the indicator the moment the first of several finishes.
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private requestCount = 0;
  private shownAt: number | null = null;
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly loading = signal(false);
  readonly isLoading: Signal<boolean> = this.loading.asReadonly();

  start(): void {
    this.requestCount++;

    if (this.hideTimeoutId !== null) {
      clearTimeout(this.hideTimeoutId);
      this.hideTimeoutId = null;
    }

    if (!this.loading()) {
      this.shownAt = Date.now();
      this.loading.set(true);
    }
  }

  stop(): void {
    this.requestCount = Math.max(0, this.requestCount - 1);

    if (this.requestCount > 0) {
      return;
    }

    const elapsed = this.shownAt === null ? MIN_VISIBLE_DURATION_MS : Date.now() - this.shownAt;
    const remaining = MIN_VISIBLE_DURATION_MS - elapsed;

    if (remaining <= 0) {
      this.hide();
      return;
    }

    this.hideTimeoutId = setTimeout(() => this.hide(), remaining);
  }

  private hide(): void {
    this.hideTimeoutId = null;
    this.shownAt = null;
    this.loading.set(false);
  }
}
