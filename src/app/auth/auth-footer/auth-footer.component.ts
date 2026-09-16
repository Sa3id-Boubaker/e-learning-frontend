import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Bloc "auth-footer" partagé par SigninComponent, SignupComponent et ForgotPasswordComponent
 * (marquage identique dans les 3 pages, signalé comme code dupliqué par SonarQube).
 * Le clic sur "contactUs" est remonté au parent, qui garde la responsabilité d'ouvrir
 * sa propre <app-support-contact-modal> (chaque page conserve son supportModalOpen).
 */
@Component({
  selector: 'app-auth-footer',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './auth-footer.component.html',
  styleUrl: './auth-footer.component.scss'
})
export class AuthFooterComponent {
  @Output() readonly contactUs = new EventEmitter<void>();
}
