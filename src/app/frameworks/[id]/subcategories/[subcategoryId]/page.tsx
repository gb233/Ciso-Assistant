import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { getFrameworkServer } from '@/lib/data-loader-server';
import BreadcrumbNav from '@/components/BreadcrumbNav';
import { getServerLanguage } from '@/lib/server-language';
import type { Category, Requirement, Subcategory } from '@/lib/data-loader';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string; subcategoryId: string };
}

export default async function FrameworkSubcategoryPage({ params }: Props) {
  const lang = getServerLanguage();
  const isZh = lang === 'zh';
  const framework = await getFrameworkServer(params.id, lang);

  if (!framework) {
    notFound();
  }

  let parentCategory: Category | null = null;
  let targetSubcategory: Subcategory | null = null;

  for (const category of framework.categories) {
    const found = category.subcategories.find((subcategory) => subcategory.id === params.subcategoryId);
    if (found) {
      parentCategory = category;
      targetSubcategory = found;
      break;
    }
  }

  if (!parentCategory || !targetSubcategory) {
    notFound();
  }

  const breadcrumbItems = [
    { label: framework.name, href: `/frameworks/${framework.id}` },
    { label: parentCategory.name, href: `/frameworks/${framework.id}/categories/${parentCategory.id}` },
    {
      label: targetSubcategory.name,
      href: `/frameworks/${framework.id}/subcategories/${targetSubcategory.id}`,
    },
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
            {targetSubcategory.code} {targetSubcategory.name}
          </h1>
          <p className="text-gray-600">
            {isZh
              ? `${parentCategory.name} · ${targetSubcategory.requirements.length} 项要求`
              : `${parentCategory.name} · ${targetSubcategory.requirements.length} requirements`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-2">
            <ListChecks className="w-4 h-4 text-cyan-700" />
            {isZh ? '子分类说明' : 'Subcategory Overview'}
          </h2>
          <p className="text-sm text-slate-600">{targetSubcategory.description || (isZh ? '暂无描述。' : 'No description available.')}</p>
        </div>

        <div className="space-y-3">
          {targetSubcategory.requirements.map((requirement: Requirement) => (
            <Link
              key={requirement.id}
              href={`/frameworks/${framework.id}/requirements/${requirement.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-cyan-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono text-xs text-slate-500">{requirement.code}</span>
                <h2 className="font-medium text-slate-900">{requirement.name}</h2>
              </div>
              <p className="text-sm text-slate-600 line-clamp-2">{requirement.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
