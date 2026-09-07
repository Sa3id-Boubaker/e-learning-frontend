// angular import
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// project import
import { SpinnerComponent } from './theme/shared/components/spinner/spinner.component';
import { ToastContainerComponent } from './theme/shared/components/toast/toast-container.component';
import { GlobalLoadingIndicatorComponent } from './theme/shared/components/global-loading-indicator/global-loading-indicator.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet, SpinnerComponent, ToastContainerComponent, GlobalLoadingIndicatorComponent]
})
export class AppComponent {
  // public props
  title = 'mantis-free-version';
}
