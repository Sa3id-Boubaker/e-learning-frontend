// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import { AdminLayout } from './theme/layouts/admin-layout/admin-layout.component';
import { GuestLayoutComponent } from './theme/layouts/guest-layout/guest-layout.component';

const routes: Routes = [
  {
    // Public landing page. Must stay before the AdminLayout block below — pathMatch: 'full'
    // means it only claims the exact bare '/', so it never intercepts '/dashboard/default' etc.
    // LandingComponent itself redirects an already-signed-in visitor straight to the dashboard.
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./landing/landing.component').then((c) => c.LandingComponent)
  },
  {
    path: '',
    component: AdminLayout,
    children: [
      {
        path: 'dashboard/default',
        loadComponent: () => import('./demo/dashboard/default/default.component').then((c) => c.DefaultComponent)
      },
      {
        path: 'typography',
        loadComponent: () => import('./demo/component/basic-component/typography/typography.component').then((c) => c.TypographyComponent)
      },
      {
        path: 'color',
        loadComponent: () => import('./demo/component/basic-component/color/color.component').then((c) => c.ColorComponent)
      },
      {
        path: 'sample-page',
        loadComponent: () => import('./demo/others/sample-page/sample-page.component').then((c) => c.SamplePageComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile.component').then((c) => c.ProfileComponent)
      },
      {
        path: 'profile/change-password',
        loadComponent: () => import('./profile/change-password/change-password.component').then((c) => c.ChangePasswordComponent)
      },
      {
        path: 'notifications',
        loadComponent: () => import('./notifications/notifications-page/notifications-page.component').then((c) => c.NotificationsPageComponent)
      },
      {
        path: 'calendar',
        loadComponent: () => import('./calendar/calendar-view/calendar-view.component').then((c) => c.CalendarViewComponent)
      },
      {
        path: 'admin/users',
        loadComponent: () => import('./admin/users/admin-users.component').then((c) => c.AdminUsersComponent)
      },
      {
        path: 'admin/enrollments',
        loadComponent: () =>
          import('./courses/enrollment-management/enrollment-management.component').then((c) => c.EnrollmentManagementComponent)
      },
      {
        path: 'admin/training-enrollments',
        loadComponent: () =>
          import('./trainings/training-enrollment-management/training-enrollment-management.component').then(
            (c) => c.TrainingEnrollmentManagementComponent
          )
      },
      {
        path: 'courses',
        loadComponent: () => import('./courses/courses-list/courses-list.component').then((c) => c.CoursesListComponent)
      },
      {
        path: 'my-courses',
        loadComponent: () =>
          import('./courses/student-course-library/student-course-library.component').then((c) => c.StudentCourseLibraryComponent)
      },
      {
        path: 'courses/manage',
        loadComponent: () => import('./courses/my-courses/my-courses.component').then((c) => c.MyCoursesComponent)
      },
      {
        path: 'courses/:id',
        loadComponent: () => import('./courses/course-detail/course-detail.component').then((c) => c.CourseDetailComponent)
      },
      {
        path: 'courses/:id/quiz',
        loadComponent: () => import('./courses/quiz-page/quiz-page.component').then((c) => c.QuizPageComponent)
      },
      {
        path: 'courses/:id/certificate',
        loadComponent: () => import('./courses/certificate-view/certificate-view.component').then((c) => c.CertificateViewComponent)
      },
      {
        path: 'certificates/my',
        loadComponent: () => import('./courses/my-certificates/my-certificates.component').then((c) => c.MyCertificatesComponent)
      },
      {
        path: 'courses/:id/certificates',
        loadComponent: () => import('./courses/course-certificates/course-certificates.component').then((c) => c.CourseCertificatesComponent)
      },
      {
        path: 'courses/:id/students',
        loadComponent: () =>
          import('./courses/course-enrolled-students/course-enrolled-students.component').then((c) => c.CourseEnrolledStudentsComponent)
      },
      {
        path: 'certificates',
        loadComponent: () => import('./courses/all-certificates/all-certificates.component').then((c) => c.AllCertificatesComponent)
      },
      {
        path: 'my-trainings',
        loadComponent: () => import('./trainings/my-trainings/my-trainings.component').then((c) => c.MyTrainingsComponent)
      },
      {
        path: 'trainings',
        loadComponent: () => import('./trainings/training-list/training-list.component').then((c) => c.TrainingListComponent)
      },
      {
        path: 'trainings/new',
        loadComponent: () => import('./trainings/training-form/training-form.component').then((c) => c.TrainingFormComponent)
      },
      {
        path: 'trainings/:id/edit',
        loadComponent: () => import('./trainings/training-form/training-form.component').then((c) => c.TrainingFormComponent)
      },
      {
        path: 'trainings/:id',
        loadComponent: () => import('./trainings/training-detail/training-detail.component').then((c) => c.TrainingDetailComponent)
      },
      {
        path: 'trainings/:trainingId/sessions/new',
        loadComponent: () => import('./trainings/live-session-form/live-session-form.component').then((c) => c.LiveSessionFormComponent)
      },
      {
        path: 'trainings/:trainingId/sessions/:id/edit',
        loadComponent: () => import('./trainings/live-session-form/live-session-form.component').then((c) => c.LiveSessionFormComponent)
      },
      {
        path: 'trainings/:id/students',
        loadComponent: () =>
          import('./trainings/training-enrolled-students/training-enrolled-students.component').then(
            (c) => c.TrainingEnrolledStudentsComponent
          )
      },
      {
        path: 'forum',
        loadComponent: () => import('./forum/forum-list/forum-list.component').then((c) => c.ForumListComponent)
      },
      {
        path: 'forum/:id',
        loadComponent: () => import('./forum/forum-post-detail/forum-post-detail.component').then((c) => c.ForumPostDetailComponent)
      }
    ]
  },
  {
    path: '',
    component: GuestLayoutComponent,
    children: [
      {
        path: 'login',
        loadComponent: () => import('./auth/signin/signin.component').then((c) => c.SigninComponent)
      },
      {
        path: 'register',
        loadComponent: () => import('./auth/signup/signup.component').then((c) => c.SignupComponent)
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./auth/verify-email/verify-email.component').then((c) => c.VerifyEmailComponent)
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./auth/forgot-password/forgot-password.component').then((c) => c.ForgotPasswordComponent)
      },
      {
        path: 'verify-reset-code',
        loadComponent: () => import('./auth/verify-reset-code/verify-reset-code.component').then((c) => c.VerifyResetCodeComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./auth/reset-password/reset-password.component').then((c) => c.ResetPasswordComponent)
      },
      {
        path: 'force-change-password',
        loadComponent: () =>
          import('./auth/force-change-password/force-change-password.component').then((c) => c.ForceChangePasswordComponent)
      },
      {
        // Fully public — no auth guard, no redirect-to-login logic anywhere in this branch.
        // Must remain reachable and functional for a completely signed-out visitor.
        path: 'certificates/verify/:certificateNumber',
        loadComponent: () => import('./courses/certificate-verify/certificate-verify.component').then((c) => c.CertificateVerifyComponent)
      }
    ]
  },
  {
    // Must stay last — catches any URL that matched neither layout's children above, regardless
    // of auth state (this app has no route guards to hook into either way).
    path: '**',
    loadComponent: () => import('./not-found/not-found.component').then((c) => c.NotFoundComponent)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
