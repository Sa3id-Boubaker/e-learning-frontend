import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgbCollapseModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from 'src/app/auth/auth.service';
import { TrainingService } from 'src/app/trainings/training.service';
import { AppLanguage, LANGUAGE_OPTIONS, LanguageService } from 'src/app/theme/shared/service/language.service';

type LandingTrainingCategoryIcon = 'code' | 'palette' | 'chart-bar' | 'cpu';

interface LandingTrainingCategory {
  icon: LandingTrainingCategoryIcon;
  title: string;
  description: string;
  badgeLabel: string;
  badgeClass: string;
  /** Reused from the source template's own course illustrations — undefined falls back to the icon. */
  image?: string;
  /**
   * The 3 template illustrations are square with the pastel background baked in, so they cover
   * their frame edge-to-edge. The AI illustration is a tall portrait cutout on a transparent/white
   * background, so it's letterboxed on a matching mint backdrop instead — 'cover' (default when
   * omitted) would crop it awkwardly, and stretching it edge-to-edge would distort it.
   */
  imageFit?: 'cover' | 'contain';
}

interface LandingMentor {
  avatar: string;
  rating: number;
  name: string;
  title: string;
  bio: string;
  studentsLabel: string;
  coursesCount: number;
}

interface LandingTestimonial {
  quote: string;
  avatar: string;
  name: string;
  role: string;
}

interface LandingEnrollmentStep {
  step: number;
  title: string;
  description: string;
}

const AVATAR_BASE = 'assets/images/landing/avatar';

// What the platform actually covers, not individual DB records — the real GET /api/trainings/public
// listing (used for the hero's live "Trainings" count below) currently holds test/demo data
// (titles like "html"/"docker") not fit for a marketing showcase, so this section shows the
// platform's real subject areas instead of a literal catalog snippet.
const TRAINING_CATEGORIES: LandingTrainingCategory[] = [
  {
    icon: 'code',
    title: 'landing.trainingsSection.categories.webMobile.title',
    description: 'landing.trainingsSection.categories.webMobile.description',
    badgeLabel: 'landing.trainingsSection.categories.webMobile.badgeLabel',
    badgeClass: 'bg-warning',
    image: 'assets/images/landing/course-img-1.jpg'
  },
  {
    icon: 'palette',
    title: 'landing.trainingsSection.categories.uiUx.title',
    description: 'landing.trainingsSection.categories.uiUx.description',
    badgeLabel: 'landing.trainingsSection.categories.uiUx.badgeLabel',
    badgeClass: 'bg-danger',
    image: 'assets/images/landing/course-img-2.jpg'
  },
  {
    icon: 'chart-bar',
    title: 'landing.trainingsSection.categories.dataScience.title',
    description: 'landing.trainingsSection.categories.dataScience.description',
    badgeLabel: 'landing.trainingsSection.categories.dataScience.badgeLabel',
    badgeClass: 'bg-info',
    image: 'assets/images/landing/course-img-3.jpg'
  },
  {
    icon: 'cpu',
    title: 'landing.trainingsSection.categories.digitalMarketing.title',
    description: 'landing.trainingsSection.categories.digitalMarketing.description',
    badgeLabel: 'landing.trainingsSection.categories.digitalMarketing.badgeLabel',
    badgeClass: 'bg-success',
    image: 'assets/images/landing/course-img-4.jpg'
  }
];

const MENTORS: LandingMentor[] = [
  {
    avatar: `${AVATAR_BASE}/avatar-4.jpg`,
    rating: 4.9,
    name: 'John Smith',
    title: 'landing.mentorsSection.mentors.johnSmith.title',
    bio: 'landing.mentorsSection.mentors.johnSmith.bio',
    studentsLabel: '20K+',
    coursesCount: 10
  },
  {
    avatar: `${AVATAR_BASE}/avatar-5.jpg`,
    rating: 4.8,
    name: 'Sarah Johnson',
    title: 'landing.mentorsSection.mentors.sarahJohnson.title',
    bio: 'landing.mentorsSection.mentors.sarahJohnson.bio',
    studentsLabel: '15K+',
    coursesCount: 8
  },
  {
    avatar: `${AVATAR_BASE}/avatar-6.jpg`,
    rating: 4.9,
    name: 'Mike Chen',
    title: 'landing.mentorsSection.mentors.mikeChen.title',
    bio: 'landing.mentorsSection.mentors.mikeChen.bio',
    studentsLabel: '18K+',
    coursesCount: 12
  },
  {
    avatar: `${AVATAR_BASE}/avatar-2.jpg`,
    rating: 4.8,
    name: 'Emma Davis',
    title: 'landing.mentorsSection.mentors.emmaDavis.title',
    bio: 'landing.mentorsSection.mentors.emmaDavis.bio',
    studentsLabel: '22K+',
    coursesCount: 9
  }
];

const TESTIMONIALS: LandingTestimonial[] = [
  {
    quote: 'landing.testimonialsSection.list.alexThompson.quote',
    avatar: `${AVATAR_BASE}/avatar-1.jpg`,
    name: 'Alex Thompson',
    role: 'landing.testimonialsSection.list.alexThompson.role'
  },
  {
    quote: 'landing.testimonialsSection.list.jessicaLee.quote',
    avatar: `${AVATAR_BASE}/avatar-2.jpg`,
    name: 'Jessica Lee',
    role: 'landing.testimonialsSection.list.jessicaLee.role'
  },
  {
    quote: 'landing.testimonialsSection.list.davidPark.quote',
    avatar: `${AVATAR_BASE}/avatar-3.jpg`,
    name: 'David Park',
    role: 'landing.testimonialsSection.list.davidPark.role'
  },
  {
    quote: 'landing.testimonialsSection.list.mariaGarcia.quote',
    avatar: `${AVATAR_BASE}/avatar-4.jpg`,
    name: 'Maria Garcia',
    role: 'landing.testimonialsSection.list.mariaGarcia.role'
  },
  {
    quote: 'landing.testimonialsSection.list.jamesWilson.quote',
    avatar: `${AVATAR_BASE}/avatar-5.jpg`,
    name: 'James Wilson',
    role: 'landing.testimonialsSection.list.jamesWilson.role'
  },
  {
    quote: 'landing.testimonialsSection.list.emilyChen.quote',
    avatar: `${AVATAR_BASE}/avatar-6.jpg`,
    name: 'Emily Chen',
    role: 'landing.testimonialsSection.list.emilyChen.role'
  }
];

// Omarise has no subscription tiers — courses/trainings are each priced individually (see the
// real Courses section above) and there's no self-service checkout: enrollment is arranged
// manually by the admin team (same flow as CourseDetailComponent's "locked" card and
// TrainingPurchaseModalComponent — see AdminContactComponent). A 3-tier SaaS pricing table would
// misrepresent how the platform actually works, so this section explains the real flow instead.
const ENROLLMENT_STEPS: LandingEnrollmentStep[] = [
  {
    step: 1,
    title: 'landing.pricing.steps.createAccount.title',
    description: 'landing.pricing.steps.createAccount.description'
  },
  {
    step: 2,
    title: 'landing.pricing.steps.chooseWhatToLearn.title',
    description: 'landing.pricing.steps.chooseWhatToLearn.description'
  },
  {
    step: 3,
    title: 'landing.pricing.steps.contactUsToEnroll.title',
    description: 'landing.pricing.steps.contactUsToEnroll.description'
  }
];

// Same contact channels as AdminContactComponent (src/app/courses/admin-contact) — the platform's
// one real "how do I actually get enrolled" mechanism.
const ADMIN_EMAIL = 'Omarise234@gmail.com';
const ADMIN_WHATSAPP_NUMBER = '21627672459';
const ADMIN_FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61578452683266&sk=about';
const WHATSAPP_MESSAGE = 'Bonjour, je souhaite avoir des informations sur vos cours.';

const SCROLL_SPY_OFFSET_PX = 100;
const SMOOTH_SCROLL_OFFSET_PX = 80;
// GET /api/trainings/public bounds its own limit param to 20 server-side — this is the largest
// count we can ever honestly show without a dedicated total-count endpoint we don't have. When the
// fetch hits this cap, the real total may be higher, so the label is shown as "20+" rather than exact.
const LANDING_TRAININGS_COUNT_FETCH_LIMIT = 20;

@Component({
  selector: 'app-landing',
  imports: [CommonModule, RouterLink, NgbCollapseModule, NgbDropdownModule, TranslatePipe],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly trainingService = inject(TrainingService);
  private readonly router = inject(Router);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly languageService = inject(LanguageService);
  readonly languageOptions = LANGUAGE_OPTIONS;

  readonly mentors = MENTORS;
  readonly testimonials = TESTIMONIALS;
  readonly enrollmentSteps = ENROLLMENT_STEPS;
  readonly trainingCategories = TRAINING_CATEGORIES;
  readonly currentYear = new Date().getFullYear();

  readonly contactEmailLink = `mailto:${ADMIN_EMAIL}`;
  readonly contactWhatsAppLink = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  readonly contactFacebookLink = ADMIN_FACEBOOK_URL;

  mobileNavOpen = false;
  activeSectionId = 'hero';

  trainingCountLabel = '';

  private sections: HTMLElement[] = [];

  ngOnInit(): void {
    // Already-signed-in visitors (valid session cookie) skip the landing page and go straight
    // into the app. A 401 here just means "not logged in" — stay on the landing page, same as
    // every other unauthenticated caller of getProfile() in this app (e.g. NavRightComponent).
    this.authService
      .getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => void this.router.navigateByUrl('/dashboard/default'),
        error: () => {}
      });

    this.loadTrainings();
  }

  // Only the count is used (hero "X Trainings" stat) — the section below shows curated subject
  // areas instead of individual real records, see TRAINING_CATEGORIES.
  private loadTrainings(): void {
    this.trainingService
      .getPublicTrainings(LANDING_TRAININGS_COUNT_FETCH_LIMIT)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (trainings) => {
          this.trainingCountLabel = trainings.length >= LANDING_TRAININGS_COUNT_FETCH_LIMIT ? `${trainings.length}+` : `${trainings.length}`;
          this.cdr.markForCheck();
        },
        // Fail soft — never show an error to an anonymous visitor here, the hero stat just stays hidden.
        error: () => {}
      });
  }

  ngAfterViewInit(): void {
    this.sections = Array.from(this.elementRef.nativeElement.querySelectorAll<HTMLElement>('section[id]'));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrollPos = window.scrollY + SCROLL_SPY_OFFSET_PX;

    for (const section of this.sections) {
      if (scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
        this.activeSectionId = section.id;
        break;
      }
    }
  }

  currentLanguageLabel(): string {
    return this.languageOptions.find((option) => option.code === this.languageService.currentLang())?.label ?? '';
  }

  selectLanguage(code: AppLanguage): void {
    this.languageService.setLanguage(code);
  }

  scrollToSection(sectionId: string, event: Event): void {
    event.preventDefault();
    this.mobileNavOpen = false;

    const target = document.getElementById(sectionId);
    if (target) {
      window.scrollTo({ top: target.offsetTop - SMOOTH_SCROLL_OFFSET_PX, behavior: 'smooth' });
    }
  }
}
