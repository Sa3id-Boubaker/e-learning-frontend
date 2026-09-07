// Angular import
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

// Project import
import { SharedModule } from '../../shared/shared.module';
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { NavigationComponent } from './navigation/navigation.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { LayoutStateService } from '../../shared/service/layout-state.service';
import { SupportContactModalComponent } from './navigation/support-contact-modal/support-contact-modal.component';

@Component({
  selector: 'app-admin',
  imports: [
    CommonModule,
    SharedModule,
    NavigationComponent,
    NavBarComponent,
    RouterModule,
    BreadcrumbComponent,
    SupportContactModalComponent,
    TranslatePipe
  ],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayout {
  private layoutState = inject(LayoutStateService);

  // public props
  navCollapsed = false;
  windowWidth: number;

  // Same footer "Contact us" trigger as the sidebar's "Need help?" card — same modal, separate
  // instance, each owned by the component that renders its own trigger.
  supportModalOpen = false;

  // Constructor
  constructor() {
    this.windowWidth = window.innerWidth;
  }

  openSupportModal(): void {
    this.supportModalOpen = true;
  }

  onSupportModalClosed(): void {
    this.supportModalOpen = false;
  }

  get navCollapsedMob(): boolean {
    return this.layoutState.navCollapsedMob();
  }

  // public method
  navMobClick() {
    this.layoutState.toggleNavCollapsedMob();
    if (document.querySelector('app-navigation.pc-sidebar')?.classList.contains('navbar-collapsed')) {
      document.querySelector('app-navigation.pc-sidebar')?.classList.remove('navbar-collapsed');
    }
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }

  closeMenu() {
    this.layoutState.closeNavCollapsedMob();
  }

  handleNavCollapse() {
    this.navCollapsed = !this.navCollapsed;
  }
}

