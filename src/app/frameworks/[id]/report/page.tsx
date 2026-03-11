import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getFrameworkServer } from '@/lib/data-loader-server';
import BreadcrumbNav from '@/components/BreadcrumbNav';
import ReportClient from '@/components/ReportClient';
import { getServerLanguage } from '@/lib/server-language';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function FrameworkReportPage({ params }: Props) {
  const lang = getServerLanguage();
  const isZh = lang === 'zh';
  const framework = await getFrameworkServer(params.id, lang);

  if (!framework) {
    notFound();
  }

  const breadcrumbItems = [
    { label: framework.name, href: `/frameworks/${framework.id}` },
    { label: isZh ? '评估报告' : 'Assessment Report', href: `/frameworks/${framework.id}/report` }
  ];

  const allRequirements = framework.categories.flatMap(category =>
    category.subcategories.flatMap(subcategory =>
      subcategory.requirements
        .filter((req) => req.questionType !== 'rubric')
        .map(req => ({
        ...req,
        categoryName: category.name,
        subcategoryName: subcategory.name
        }))
    )
  );

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
            {framework.name} {isZh ? '评估报告' : 'Assessment Report'}
          </h1>
          <p className="text-gray-600">
            {isZh ? '查看评估结果、成熟度分析和改进建议' : 'Review assessment results, maturity analysis, and recommendations'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <Link
              href={`/frameworks/${framework.id}`}
              className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            >
              {isZh ? '框架结构' : 'Framework Structure'}
            </Link>
            <button className="px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
              {isZh ? '评估报告' : 'Report'}
            </button>
          </div>
        </div>

        <ReportClient
          framework={framework}
          requirements={allRequirements}
        />
      </main>
    </div>
  );
}
