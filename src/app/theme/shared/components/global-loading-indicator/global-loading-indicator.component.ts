import { Component, inject } from '@angular/core';

import { LoadingService } from '../../service/loading.service';

@Component({
  selector: 'app-global-loading-indicator',
  templateUrl: './global-loading-indicator.component.html',
  styleUrl: './global-loading-indicator.component.scss'
})
export class GlobalLoadingIndicatorComponent {
  private readonly loadingService = inject(LoadingService);

  readonly isLoading = this.loadingService.isLoading;
}
