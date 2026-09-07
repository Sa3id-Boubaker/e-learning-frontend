import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import { DeleteOutline, EditOutline, PlusOutline, SearchOutline } from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { AdminUserService } from '../admin-user.service';
import { AdminManagedRole, AdminUserResponse, PageResponse } from '../models/admin-user.models';
import { UserFormModalComponent, UserFormModalMode } from './user-form-modal/user-form-modal.component';

const SEARCH_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-admin-users',
  imports: [SharedModule, UserFormModalComponent, DeleteConfirmationModalComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private readonly adminUserService = inject(AdminUserService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;

  activeTab: AdminManagedRole = 'ETUDIANT';
  users: AdminUserResponse[] = [];
  loading = false;
  loadError = '';

  readonly pageSize = 10;
  currentPage = 0;
  totalElements = 0;
  totalPages = 0;

  readonly searchControl = new FormControl('', { nonNullable: true });
  searchTerm = '';
  searching = false;

  studentsCount: number | null = null;
  trainersCount: number | null = null;

  formModalOpen = false;
  formModalMode: UserFormModalMode = 'create';
  selectedUser: AdminUserResponse | null = null;

  deleteModalOpen = false;
  userPendingDelete: AdminUserResponse | null = null;
  deleteLoading = false;

  constructor() {
    this.iconService.addIcon(...[EditOutline, DeleteOutline, PlusOutline, SearchOutline]);

    this.searchControl.valueChanges.pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe((term) => {
      this.searchTerm = term;
      this.currentPage = 0;
      this.loadUsers({ isSearch: true });
    });
  }

  get pageStart(): number {
    return this.totalElements === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }

  get hasPreviousPage(): boolean {
    return this.currentPage > 0;
  }

  get hasNextPage(): boolean {
    return this.currentPage + 1 < this.totalPages;
  }

  get deleteModalTitle(): string {
    if (!this.userPendingDelete) {
      return this.translateService.instant('admin.users.deleteTitleGeneric');
    }

    return this.translateService.instant('admin.users.deleteTitleNamed', {
      name: `${this.userPendingDelete.firstName} ${this.userPendingDelete.lastName}`
    });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadCounts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initialsFor(user: AdminUserResponse): string {
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  switchTab(role: AdminManagedRole): void {
    if (role === this.activeTab) {
      return;
    }

    this.activeTab = role;
    this.currentPage = 0;
    this.searchTerm = '';
    this.searchControl.setValue('', { emitEvent: false });
    this.loadUsers();
  }

  loadUsers(options: { isSearch?: boolean } = {}): void {
    const isSearch = options.isSearch === true;

    if (isSearch) {
      this.searching = true;
    } else {
      this.loading = true;
      this.loadError = '';
    }

    const request$: Observable<PageResponse<AdminUserResponse>> =
      this.activeTab === 'ETUDIANT'
        ? this.adminUserService.listStudents(this.currentPage, this.pageSize, this.searchTerm)
        : this.adminUserService.listTrainers(this.currentPage, this.pageSize, this.searchTerm);

    request$
      .pipe(
        finalize(() => {
          if (isSearch) {
            this.searching = false;
          } else {
            this.loading = false;
          }
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.users = result.content;
          this.currentPage = result.page;
          this.totalElements = result.totalElements;
          this.totalPages = result.totalPages;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401 || status === 403) {
            return;
          }

          const message = (error?.error as ApiErrorResponse | undefined)?.message ?? this.translateService.instant('admin.users.loadError');

          if (isSearch) {
            this.toastService.error(message);
          } else {
            this.loadError = message;
          }
        }
      });
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage || this.loading) {
      return;
    }

    this.currentPage -= 1;
    this.loadUsers();
    this.scrollTableToTop();
  }

  goToNextPage(): void {
    if (!this.hasNextPage || this.loading) {
      return;
    }

    this.currentPage += 1;
    this.loadUsers();
    this.scrollTableToTop();
  }

  openCreateModal(): void {
    this.formModalMode = 'create';
    this.selectedUser = null;
    this.formModalOpen = true;
  }

  openEditModal(user: AdminUserResponse): void {
    this.formModalMode = 'edit';
    this.selectedUser = user;
    this.formModalOpen = true;
  }

  onFormModalClosed(): void {
    this.formModalOpen = false;
  }

  onUserSaved(): void {
    this.formModalOpen = false;
    this.loadUsers();
    this.loadCounts();
  }

  openDeleteModal(user: AdminUserResponse): void {
    this.userPendingDelete = user;
    this.deleteModalOpen = true;
  }

  onDeleteModalClosed(): void {
    if (this.deleteLoading) {
      return;
    }

    this.deleteModalOpen = false;
    this.userPendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.userPendingDelete || this.deleteLoading) {
      return;
    }

    this.deleteLoading = true;
    const user = this.userPendingDelete;

    this.adminUserService
      .deleteUser(user.id)
      .pipe(
        finalize(() => {
          this.deleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(
            this.translateService.instant('admin.users.userDeleted', { name: `${user.firstName} ${user.lastName}` })
          );
          this.deleteModalOpen = false;
          this.userPendingDelete = null;

          // Deleting the last remaining item on a page beyond the first steps back a page
          // rather than refetching into an empty page.
          if (this.currentPage > 0 && this.users.length === 1) {
            this.currentPage -= 1;
          }

          this.loadUsers();
          this.loadCounts();
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401 || status === 403) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('admin.users.deleteError'));
        }
      });
  }

  private loadCounts(): void {
    this.adminUserService
      .getUserCounts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (counts) => {
          this.studentsCount = counts.studentsCount;
          this.trainersCount = counts.trainersCount;
          this.cdr.markForCheck();
        },
        error: () => {
          // Counts are supplementary to the tab labels; a failure here shouldn't block the page.
        }
      });
  }

  private scrollTableToTop(): void {
    this.tableContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
