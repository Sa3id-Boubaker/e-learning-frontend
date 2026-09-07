/**
 * This app renders icons via @ant-design/icons-angular (see IconService.addIcon usage
 * across components), not lucide-react — so this returns an antIcon `type` string rather
 * than a component. Matching is a best-effort keyword lookup against free-text categories.
 */
export function getCategoryIcon(category: string): string {
  const normalized = category.toLowerCase();

  if (normalized.includes('backend')) {
    return 'cloud-server';
  }

  if (normalized.includes('frontend')) {
    return 'code';
  }

  if (normalized.includes('mobile')) {
    return 'mobile';
  }

  if (normalized.includes('design') || normalized.includes('ux')) {
    return 'bg-colors';
  }

  if (normalized.includes('data')) {
    return 'database';
  }

  return 'book';
}
