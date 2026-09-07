export interface CourseResponse {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  finalPrice: number;
  image: string | null;
  instructorId: string;
  instructorFirstName: string | null;
  instructorLastName: string | null;
  instructorEmail: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCourseRequest {
  title: string;
  description: string;
  category: string;
  price: number;
  published?: boolean;
  image?: File;
}

export interface UpdateCourseRequest {
  title?: string;
  description?: string;
  category?: string;
  price?: number;
  published?: boolean;
}

/** ADMIN-only lightweight listing (id + title only, unpaginated) — for filter dropdowns, not the course catalog. */
export interface CourseSummary {
  id: string;
  title: string;
}

/** Anonymous-safe — GET /api/courses/public, no auth required. No instructor/description/published/createdAt fields. For the public landing page only. */
export interface PublicCourseResponse {
  id: string;
  title: string;
  category: string;
  image: string | null;
  price: number;
  finalPrice: number;
}
