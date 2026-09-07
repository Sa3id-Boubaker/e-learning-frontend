// angular import
import { Component, OnInit, output, inject, input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/auth/auth.service';
import { UserProfileResponse } from 'src/app/auth/models/auth.models';
import { ToastService } from 'src/app/theme/shared/components/toast/toast.service';
import { NotificationDropdownComponent } from 'src/app/notifications/notification-dropdown/notification-dropdown.component';
import { NotificationService } from 'src/app/notifications/notification.service';
import { NotificationStreamService } from 'src/app/notifications/notification-stream.service';
import { AppLanguage, LANGUAGE_OPTIONS, LanguageService } from 'src/app/theme/shared/service/language.service';

// third party

// icon
import { IconService } from '@ant-design/icons-angular';
import {
  BellOutline,
  SettingOutline,
  GiftOutline,
  MessageOutline,
  PhoneOutline,
  CheckCircleOutline,
  LogoutOutline,
  EditOutline,
  UserOutline,
  QuestionCircleOutline,
  LockOutline,
  CommentOutline,
  UnorderedListOutline,
  ArrowRightOutline,
  TeamOutline,
  ReadOutline,
  GlobalOutline,
  CheckOutline
} from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-nav-right',
  imports: [SharedModule, RouterModule, NotificationDropdownComponent, TranslatePipe],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss']
})
export class NavRightComponent implements OnInit {
  private iconService = inject(IconService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  // Not otherwise referenced here — injecting it is what bootstraps its constructor (the SSE
  // connect/disconnect subscription), since this is the permanently-mounted home of the bell.
  private readonly notificationStreamService = inject(NotificationStreamService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private translateService = inject(TranslateService);
  readonly languageService = inject(LanguageService);

  // public props
  styleSelectorToggle = input<boolean>();
  readonly Customize = output();
  windowWidth: number;
  screenFull: boolean = true;
  direction: string = 'ltr';
  readonly currentUser$ = this.authService.currentUser$;
  readonly unreadCount$ = this.notificationService.unreadCount$;
  notificationsDropdownOpen = false;

  // constructor
  constructor() {
    this.windowWidth = window.innerWidth;
    this.iconService.addIcon(
      ...[
        CheckCircleOutline,
        GiftOutline,
        MessageOutline,
        SettingOutline,
        PhoneOutline,
        LogoutOutline,
        EditOutline,
        UserOutline,
        QuestionCircleOutline,
        LockOutline,
        CommentOutline,
        UnorderedListOutline,
        ArrowRightOutline,
        BellOutline,
        TeamOutline,
        ReadOutline,
        GlobalOutline,
        CheckOutline
      ]
    );
  }

  // `title` stays the English literal used as the click-routing identifier in onProfileAction()
  // below — never used for display. `titleKey` is what the template renders via | translate.
  profile = [
    {
      icon: 'user',
      title: 'My Profile',
      titleKey: 'nav.header.profile.myProfile'
    },
    {
      icon: 'logout',
      title: 'Logout',
      titleKey: 'nav.header.profile.logout'
    }
  ];

  setting = [
    {
      icon: 'question-circle',
      title: 'Support',
      titleKey: 'nav.header.settings.support'
    },
    {
      icon: 'user',
      title: 'Account Settings',
      titleKey: 'nav.header.settings.accountSettings'
    },
    {
      icon: 'lock',
      title: 'Privacy Center',
      titleKey: 'nav.header.settings.privacyCenter'
    },
    {
      icon: 'comment',
      title: 'Feedback',
      titleKey: 'nav.header.settings.feedback'
    },
    {
      icon: 'unordered-list',
      title: 'History',
      titleKey: 'nav.header.settings.history'
    }
  ];

  readonly languageOptions = LANGUAGE_OPTIONS;

  ngOnInit(): void {
    this.authService.getProfile().subscribe({ error: () => {} });
  }

  initialsFor(user: UserProfileResponse | null): string {
    if (!user) {
      return '?';
    }

    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  /** Piped through | translate at every call site — a real name harmlessly passes through unchanged when no matching key exists. */
  displayNameFor(user: UserProfileResponse | null): string {
    if (!user) {
      return 'nav.header.myAccount';
    }

    return `${user.firstName} ${user.lastName}`.trim();
  }

  selectLanguage(code: AppLanguage): void {
    this.languageService.setLanguage(code);
  }

  onProfileAction(title: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    if (title === 'Logout') {
      this.logout();
      return;
    }

    if (title === 'My Profile') {
      void this.router.navigateByUrl('/profile');
    }
  }

  logout(event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.toastService.info(this.translateService.instant('nav.header.loggedOutMessage'));

    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/login');
      },
      error: () => {
        void this.router.navigateByUrl('/login');
      }
    });
  }
}
