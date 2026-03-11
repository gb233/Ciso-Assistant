import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Layers3 } from 'lucide-react';
import { getFrameworkServer } from '@/lib/data-loader-server';
import BreadcrumbNav from '@/components/BreadcrumbNav';
import { getServerLanguage } from '@/lib/server-language';
import type { Requirement, Subcategory } from '@/lib/data-loader';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string; categoryId: string };
}

export default async function FrameworkCategoryPage({ params }: Props) {
  const lang = getServerLanguage();
  const isZh = lang === 'zh';
  const framework = await getFrameworkServer(params.id, lang);

  if (!framework) {
    notFound();
  }

  const category = framework.categories.find((item) => item.id === params.categoryId);
  if (!category) {
    notFound();
  }

  const requirementRows = category.subcategories.flatMap((subcategory: Subcategory) =>
    subcategory.requirements.map((requirement) => ({
      requirement: requirement as Requirement,
      subcategory,
    }))
  );

  const breadcrumbItems = [
    { label: framework.name, href: `/frameworks/${framework.id}` },
    { label: category.name, href: `/frameworks/${framework.id}/categories/${category.id}` },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BreadcrumbNav items={breadcrumbItems} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {category.code} {category.name}
          </h1>
          <p className="text-gray-600">
            {isZh
              ? `${framework.name} · ${requirementRows.length} 项要求，按子分类聚合展示。`
              : `${framework.name} · ${requirementRows.length} requirements grouped by subcategory.`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {requirementRows.map(({ requirement, subcategory }) => (
              <Link
                key={requirement.id}
                href={`/frameworks/${framework.id}/requirements/${requirement.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-cyan-300 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <span>{subcategory.code}</span>
                  <span>·</span>
                  <span>{subcategory.name}</span>
                </div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-xs text-slate-500">{requirement.code}</span>
                  <h2 className="font-medium text-slate-900">{requirement.name}</h2>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{requirement.description}</p>
              </Link>
            ))}
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 h-fit">
            <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Layers3 className="w-4 h-4 text-cyan-700" />
              {isZh ? '子分类导航' : 'Subcategory Navigation'}
            </h2>
            <div className="space-y-2 text-sm">
              {category.subcategories.map((subcategory) => (
                <Link
                  key={subcategory.id}
                  href={`/frameworks/${framework.id}/subcategories/${subcategory.id}`}
                  className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                >
                  <div className="font-medium text-slate-800">
                    {subcategory.code} {subcategory.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {subcategory.requirements.length} {isZh ? '项要求' : 'requirements'}
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
