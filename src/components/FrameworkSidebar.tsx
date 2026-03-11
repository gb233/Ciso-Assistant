'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Framework, FrameworkMeta } from '@/lib/data-loader';
import FrameworkSelector from './FrameworkSelector';
import { useLanguage } from './LanguageProvider';

interface FrameworkSidebarProps {
  framework: Framework;
  allFrameworks: FrameworkMeta[];
  selectedCategoryId?: string;
  selectedSubcategoryId?: string;
}

export default function FrameworkSidebar({
  framework,
  allFrameworks,
  selectedCategoryId,
  selectedSubcategoryId
}: FrameworkSidebarProps) {
  const { language } = useLanguage();
  const isZh = language === 'zh';

  const getControlRequirements = (subcategory: Framework['categories'][number]['subcategories'][number]) =>
    subcategory.requirements.filter((requirement) => requirement.questionType !== 'rubric');

  const initialExpandedCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    if (framework.categories[0]) ids.add(framework.categories[0].id);
    if (selectedCategoryId) ids.add(selectedCategoryId);
    return Array.from(ids);
  }, [framework.categories, selectedCategoryId]);

  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>(initialExpandedCategoryIds);

  useEffect(() => {
    setExpandedCategoryIds(initialExpandedCategoryIds);
  }, [framework.id, initialExpandedCategoryIds]);

  const isCategoryExpanded = useCallback(
    (categoryId: string) => expandedCategoryIds.includes(categoryId),
    [expandedCategoryIds]
  );

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategoryIds((current) => {
      if (current.includes(categoryId)) {
        return current.filter((id) => id !== categoryId);
      }
      return [...current, categoryId];
    });
  }, []);

  return (
    <aside className="w-80 border-r border-slate-900/70 bg-[#232b49] text-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-white/15">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/frameworks"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10.5l9-7 9 7M5.25 9.5v9h13.5v-9" />
            </svg>
            <span>{isZh ? '主页' : 'Home'}</span>
          </Link>
          <Link
            href={`/frameworks/${framework.id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>{isZh ? '浏览框架' : 'Browse Framework'}</span>
          </Link>
        </div>

        <div className="mt-3">
          <FrameworkSelector
            currentFramework={framework}
            allFrameworks={allFrameworks}
            variant="sidebar-dark"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="px-2 text-[11px] uppercase tracking-[0.1em] text-slate-400 mb-2">
          {isZh ? '框架结构' : 'Framework Structure'}
        </p>

        <Link
          href={`/frameworks/${framework.id}`}
          className={`mb-2 flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
            !selectedCategoryId && !selectedSubcategoryId
              ? 'bg-white/15 text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span>{isZh ? '全部要求' : 'All requirements'}</span>
          <span className="text-xs text-slate-400">
            {framework.categories.reduce(
              (sum, category) => sum + category.subcategories.reduce((acc, sub) => acc + getControlRequirements(sub).length, 0),
              0
            )}
          </span>
        </Link>

        <div className="space-y-2">
          {framework.categories.map((category) => {
            const activeCategory = selectedCategoryId === category.id && !selectedSubcategoryId;
            const expanded = isCategoryExpanded(category.id);
            const categoryRequirementCount = category.subcategories.reduce(
              (sum, sub) => sum + getControlRequirements(sub).length,
              0
            );

            return (
              <section key={category.id} className="rounded-md">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label={expanded ? (isZh ? '折叠分类' : 'Collapse category') : (isZh ? '展开分类' : 'Expand category')}
                    aria-expanded={expanded}
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <Link
                    href={`/frameworks/${framework.id}?category=${encodeURIComponent(category.id)}`}
                    className={`flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                      activeCategory
                        ? 'bg-white/15 text-white'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{category.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{categoryRequirementCount}</span>
                  </Link>
                </div>

                {expanded && (
                  <div className="ml-7 mt-1 border-l border-white/20 pl-3 space-y-1">
                    {category.subcategories.map((subcategory) => {
                      const activeSubcategory = selectedSubcategoryId === subcategory.id;
                      const subcategoryRequirements = getControlRequirements(subcategory).length;
                      return (
                        <Link
                          key={subcategory.id}
                          href={`/frameworks/${framework.id}?category=${encodeURIComponent(category.id)}&subcategory=${encodeURIComponent(subcategory.id)}`}
                          className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                            activeSubcategory
                              ? 'bg-white/15 text-white'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{subcategory.name}</span>
                          <span className="ml-2 text-xs text-slate-400">{subcategoryRequirements}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
