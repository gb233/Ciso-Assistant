import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';
import { getFrameworkServer, getFrameworksServer } from '@/lib/data-loader-server';
import { getServerLanguage } from '@/lib/server-language';
import {
  resolveFrameworkPresentationProfile,
  type FrameworkPresentationMode,
} from '@/lib/framework-presentation';
import DefaultFrameworkModeView from '@/components/framework-modes/DefaultFrameworkModeView';
import SammyFrameworkModeView from '@/components/framework-modes/SammyFrameworkModeView';
import RegulationFrameworkModeView from '@/components/framework-modes/RegulationFrameworkModeView';
import type { FrameworkModeViewProps } from '@/components/framework-modes/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
  searchParams?: {
    category?: string | string[];
    subcategory?: string | string[];
  };
}

function resolveQueryParam(value?: string | string[]): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return undefined;
}

const MODE_VIEW_COMPONENTS = {
  default: DefaultFrameworkModeView,
  sammy: SammyFrameworkModeView,
  regulation: RegulationFrameworkModeView,
} as const satisfies Record<FrameworkPresentationMode, ComponentType<FrameworkModeViewProps>>;

export default async function FrameworkPage({ params, searchParams }: Props) {
  const lang = getServerLanguage();
  const isZh = lang === 'zh';

  const framework = await getFrameworkServer(params.id, lang);
  const allFrameworks = await getFrameworksServer(lang);

  if (!framework) {
    notFound();
  }

  const presentationProfile = resolveFrameworkPresentationProfile(framework);

  const allRequirements = framework.categories.flatMap((category) =>
    category.subcategories.flatMap((subcategory) =>
      subcategory.requirements
        .filter((requirement) => requirement.questionType !== 'rubric')
        .map((requirement) => ({
        ...requirement,
        categoryName: category.name,
        subcategoryName: subcategory.name,
        }))
    )
  );

  const requestedCategoryId = resolveQueryParam(searchParams?.category);
  const requestedSubcategoryId = resolveQueryParam(searchParams?.subcategory);

  let selectedCategory = requestedCategoryId
    ? framework.categories.find((category) => category.id === requestedCategoryId) || null
    : null;
  let selectedSubcategory = null as (typeof framework.categories)[number]['subcategories'][number] | null;

  if (requestedSubcategoryId) {
    for (const category of framework.categories) {
      const subcategory = category.subcategories.find((item) => item.id === requestedSubcategoryId);
      if (subcategory) {
        selectedCategory = category;
        selectedSubcategory = subcategory;
        break;
      }
    }
  }

  const filteredRequirements = selectedSubcategory
    ? selectedSubcategory.requirements
      .filter((requirement) => requirement.questionType !== 'rubric')
      .map((requirement) => ({
        ...requirement,
        categoryName: selectedCategory?.name || '',
        subcategoryName: selectedSubcategory.name,
      }))
    : selectedCategory
      ? selectedCategory.subcategories.flatMap((subcategory) =>
          subcategory.requirements
            .filter((requirement) => requirement.questionType !== 'rubric')
            .map((requirement) => ({
            ...requirement,
            categoryName: selectedCategory?.name || '',
            subcategoryName: subcategory.name,
            }))
        )
      : allRequirements;

  const hasFilter = Boolean(selectedCategory || selectedSubcategory);
  const ModeView = MODE_VIEW_COMPONENTS[presentationProfile.mode];

  return (
    <ModeView
      framework={framework}
      allFrameworks={allFrameworks}
      filteredRequirements={filteredRequirements}
      allRequirementsCount={allRequirements.length}
      selectedCategory={selectedCategory}
      selectedSubcategory={selectedSubcategory}
      hasFilter={hasFilter}
      isZh={isZh}
      presentationProfile={presentationProfile}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const framework = await getFrameworkServer(params.id);
  return {
    title: framework ? `${framework.name} - Ciso-Assistant` : 'Framework Not Found',
    description: framework?.description,
  };
}
