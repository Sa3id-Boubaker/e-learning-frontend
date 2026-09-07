// Angular import
import { Component, OnInit, inject, output } from '@angular/core';
import { CommonModule, Location, LocationStrategy } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Observable, map } from 'rxjs';

// project import
import { NavigationItem, NavigationItems } from '../navigation';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/auth/auth.service';
import { UserProfileResponse } from 'src/app/auth/models/auth.models';
import { ToastService } from 'src/app/theme/shared/components/toast/toast.service';

import { NavGroupComponent } from './nav-group/nav-group.component';

// icon
import { IconService, IconDirective } from '@ant-design/icons-angular';
import {
  DashboardOutline,
  CalendarOutline,
  CreditCardOutline,
  LoginOutline,
  LogoutOutline,
  ChromeOutline,
  FontSizeOutline,
  ProfileOutline,
  BgColorsOutline,
  AntDesignOutline,
  TeamOutline,
  BookOutline,
  ReadOutline,
  SafetyCertificateOutline,
  ScheduleOutline,
  SolutionOutline,
  UnorderedListOutline,
  MessageOutline,
  HomeOutline,
  BarChartOutline
} from '@ant-design/icons-angular/icons';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-nav-content',
  imports: [CommonModule, RouterModule, NavGroupComponent, NgScrollbarModule, IconDirective, TranslatePipe],
  templateUrl: './nav-content.component.html',
  styleUrls: ['./nav-content.component.scss']
})
export class NavContentComponent implements OnInit {
  private location = inject(Location);
  private locationStrategy = inject(LocationStrategy);
  private iconService = inject(IconService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private translateService = inject(TranslateService);

  // public props
  NavCollapsedMob = output();

  navigations: NavigationItem[];

  // Groups/items tagged with `roles` are only shown once the signed-in user's role matches.
  readonly filteredNavigations$: Observable<NavigationItem[]> = this.authService.currentUser$.pipe(
    map((user) => this.filterByRole(NavigationItems, user?.role))
  );

  // For the sidebar footer identity card (avatar/name/role) — same source as NavRightComponent's
  // header dropdown, just a second, independent display of it here.
  readonly currentUser$ = this.authService.currentUser$;

  // version
  title = 'Demo application for version numbering';
  currentApplicationVersion = environment.appVersion;

  navigation = NavigationItems;
  windowWidth = window.innerWidth;

  // Constructor
  constructor() {
    this.iconService.addIcon(
      ...[
        DashboardOutline,
        CalendarOutline,
        CreditCardOutline,
        FontSizeOutline,
        LoginOutline,
        LogoutOutline,
        ProfileOutline,
        BgColorsOutline,
        AntDesignOutline,
        ChromeOutline,
        TeamOutline,
        BookOutline,
        ReadOutline,
        SafetyCertificateOutline,
        ScheduleOutline,
        SolutionOutline,
        UnorderedListOutline,
        MessageOutline,
        HomeOutline,
        BarChartOutline
      ]
    );
    this.navigations = NavigationItems;
  }

  // Life cycle events
  ngOnInit() {
    if (this.windowWidth < 1025) {
      (document.querySelector('.coded-navbar') as HTMLDivElement)?.classList.add('menupos-static');
    }
  }

  // Mirrors NavRightComponent's initialsFor/displayNameFor exactly — same identity card, second display of it.
  initialsFor(user: UserProfileResponse | null): string {
    if (!user) {
      return '?';
    }

    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  displayNameFor(user: UserProfileResponse | null): string {
    if (!user) {
      return 'nav.header.myAccount';
    }

    return `${user.firstName} ${user.lastName}`.trim();
  }

  roleLabelFor(user: UserProfileResponse | null): string {
    switch (user?.role) {
      case 'ADMIN':
        return this.translateService.instant('nav.header.roles.admin');
      case 'FORMATEUR':
        return this.translateService.instant('admin.userFormModal.trainer');
      case 'ETUDIANT':
        return this.translateService.instant('admin.userFormModal.student');
      default:
        return '';
    }
  }

  // Mirrors NavRightComponent's logout() exactly — same toast + redirect, just a second trigger point.
  logout(): void {
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

  fireOutClick() {
    let current_url = this.location.path();
    const baseHref = this.locationStrategy.getBaseHref();
    if (baseHref) {
      current_url = baseHref + this.location.path();
    }
    const link = "a.nav-link[ href='" + current_url + "' ]";
    const ele = document.querySelector(link);
    if (ele !== null && ele !== undefined) {
      const parent = ele.parentElement;
      const up_parent = parent?.parentElement?.parentElement;
      const last_parent = up_parent?.parentElement;
      if (parent?.classList.contains('coded-hasmenu')) {
        parent.classList.add('coded-trigger');
        parent.classList.add('active');
      } else if (up_parent?.classList.contains('coded-hasmenu')) {
        up_parent.classList.add('coded-trigger');
        up_parent.classList.add('active');
      } else if (last_parent?.classList.contains('coded-hasmenu')) {
        last_parent.classList.add('coded-trigger');
        last_parent.classList.add('active');
      }
    }
  }

  navMob() {
    if (this.windowWidth < 1025 && document.querySelector('app-navigation.coded-navbar')?.classList.contains('mob-open')) {
      this.NavCollapsedMob.emit();
    }
  }

  private filterByRole(items: NavigationItem[], role: string | undefined): NavigationItem[] {
    return items
      .filter((item) => this.isVisibleForRole(item, role))
      .map((item) => (item.children ? { ...item, children: item.children.filter((child) => this.isVisibleForRole(child, role)) } : item));
  }

  private isVisibleForRole(item: NavigationItem, role: string | undefined): boolean {
    return !item.roles || (role !== undefined && item.roles.includes(role));
  }
}
