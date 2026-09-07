import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { LoadingService } from '../service/loading.service';

/**
 * Drives the app-wide top loading bar. Applied uniformly to every outgoing request,
 * independent of any per-component/per-button loading state.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  loadingService.start();

  return next(req).pipe(finalize(() => loadingService.stop()));
};
