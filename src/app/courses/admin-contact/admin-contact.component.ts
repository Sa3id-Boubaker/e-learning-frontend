import { Component, Input, inject } from '@angular/core';

import { IconService } from '@ant-design/icons-angular';
import { FacebookOutline, MailOutline, WhatsAppOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { SharedModule } from '../../theme/shared/shared.module';

const ADMIN_EMAIL = 'Omarise234@gmail.com';
const ADMIN_WHATSAPP_NUMBER = '21627672459';
const ADMIN_FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61578452683266&sk=about';

/** Purely presentational — three external contact links, no backend calls, no outputs. */
@Component({
  selector: 'app-admin-contact',
  imports: [SharedModule],
  templateUrl: './admin-contact.component.html',
  styleUrl: './admin-contact.component.scss'
})
export class AdminContactComponent {
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  /** Personalizes the WhatsApp pre-filled message when the caller knows which course this is about. */
  @Input() courseTitle?: string;

  readonly mailtoLink = `mailto:${ADMIN_EMAIL}`;
  readonly facebookLink = ADMIN_FACEBOOK_URL;

  constructor() {
    this.iconService.addIcon(...[MailOutline, WhatsAppOutline, FacebookOutline]);
  }

  get whatsappLink(): string {
    const message = this.courseTitle
      ? this.translateService.instant('courses.adminContact.whatsappMessageForCourse', { title: this.courseTitle })
      : this.translateService.instant('courses.adminContact.whatsappMessageGeneric');

    return `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }
}
