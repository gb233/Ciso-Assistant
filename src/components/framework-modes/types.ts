import type { Framework, FrameworkMeta, Requirement } from '@/lib/data-loader';
import type { FrameworkPresentationProfile } from '@/lib/framework-presentation';

export interface RequirementWithContext extends Requirement {
  categoryName: string;
  subcategoryName: string;
}

export interface FrameworkModeViewProps {
  framework: Framework;
  allFrameworks: FrameworkMeta[];
  filteredRequirements: RequirementWithContext[];
  allRequirementsCount: number;
  selectedCategory: Framework['categories'][number] | null;
  selectedSubcategory: Framework['categories'][number]['subcategories'][number] | null;
  hasFilter: boolean;
  isZh: boolean;
  presentationProfile: FrameworkPresentationProfile;
}
