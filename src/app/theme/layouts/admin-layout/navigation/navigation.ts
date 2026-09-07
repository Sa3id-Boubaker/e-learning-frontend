export interface NavigationItem {
  id: string;
  /** English fallback — also used as the native [title] hover tooltip. See titleKey for the i18n label. */
  title: string;
  /** i18n key for the visible label (nav-item/nav-group/breadcrumb pipe this through | translate). Falls back to `title` when absent. */
  titleKey?: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  groupClasses?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  children?: NavigationItem[];
  link?: string;
  description?: string;
  path?: string;
  /** When set, this item (and its children) is only shown to signed-in users with one of these roles. */
  roles?: string[];
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'navigation',
    title: 'Navigation',
    titleKey: 'nav.groups.navigation',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'home',
        title: 'Home',
        titleKey: 'nav.items.home',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/default',
        icon: 'home',
        breadcrumbs: false,
        roles: ['ETUDIANT']
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        titleKey: 'nav.items.dashboard',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/default',
        icon: 'dashboard',
        breadcrumbs: false,
        roles: ['ADMIN']
      },
      {
        id: 'my-performance',
        title: 'My Performance',
        titleKey: 'nav.items.myPerformance',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/default',
        icon: 'bar-chart',
        breadcrumbs: false,
        roles: ['FORMATEUR']
      }
    ]
  },
  {
    id: 'courses',
    title: 'Courses',
    titleKey: 'nav.groups.courses',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'courses-browse',
        title: 'Browse Courses',
        titleKey: 'nav.items.browseCourses',
        type: 'item',
        classes: 'nav-item',
        url: '/courses',
        icon: 'book',
        breadcrumbs: false,
        roles: ['ETUDIANT']
      },
      {
        id: 'my-courses',
        title: 'My Courses',
        titleKey: 'nav.items.myCourses',
        type: 'item',
        classes: 'nav-item',
        url: '/my-courses',
        icon: 'read',
        breadcrumbs: false,
        roles: ['ETUDIANT']
      },
      {
        id: 'my-certificates',
        title: 'My Certificates',
        titleKey: 'nav.items.myCertificates',
        type: 'item',
        classes: 'nav-item',
        url: '/certificates/my',
        icon: 'safety-certificate',
        breadcrumbs: false,
        roles: ['ETUDIANT']
      },
      {
        id: 'courses-manage',
        title: 'Manage Courses',
        titleKey: 'nav.items.manageCourses',
        type: 'item',
        classes: 'nav-item',
        url: '/courses/manage',
        icon: 'unordered-list',
        breadcrumbs: false,
        roles: ['FORMATEUR', 'ADMIN']
      }
    ]
  },
  {
    id: 'trainings',
    title: 'Trainings',
    titleKey: 'nav.groups.trainings',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'trainings-list',
        title: 'Trainings',
        titleKey: 'nav.items.trainings',
        type: 'item',
        classes: 'nav-item',
        url: '/trainings',
        icon: 'schedule',
        breadcrumbs: false
      },
      {
        id: 'my-trainings',
        title: 'My Trainings',
        titleKey: 'nav.items.myTrainings',
        type: 'item',
        classes: 'nav-item',
        url: '/my-trainings',
        icon: 'solution',
        breadcrumbs: false,
        roles: ['ETUDIANT']
      },
      {
        id: 'calendar',
        title: 'Calendar',
        titleKey: 'nav.items.calendar',
        type: 'item',
        classes: 'nav-item',
        url: '/calendar',
        icon: 'calendar',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'forum',
    title: 'Forum',
    titleKey: 'nav.groups.forum',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'forum-discussions',
        title: 'Discussion Forums',
        titleKey: 'nav.items.discussionForums',
        type: 'item',
        classes: 'nav-item',
        url: '/forum',
        icon: 'message',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'administration',
    title: 'Administration',
    titleKey: 'nav.groups.administration',
    type: 'group',
    icon: 'icon-navigation',
    roles: ['ADMIN'],
    children: [
      {
        id: 'admin-users',
        title: 'Users',
        titleKey: 'nav.items.users',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/users',
        icon: 'team',
        breadcrumbs: false
      },
      {
        id: 'admin-enrollments',
        title: 'Course Enrollments',
        titleKey: 'nav.items.courseEnrollments',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/enrollments',
        icon: 'solution',
        breadcrumbs: false
      },
      {
        id: 'admin-training-enrollments',
        title: 'Training Enrollments',
        titleKey: 'nav.items.trainingEnrollments',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/training-enrollments',
        icon: 'solution',
        breadcrumbs: false
      },
      {
        id: 'admin-certificates',
        title: 'Certificates',
        titleKey: 'nav.items.certificates',
        type: 'item',
        classes: 'nav-item',
        url: '/certificates',
        icon: 'safety-certificate',
        breadcrumbs: false
      }
    ]
  }
];
