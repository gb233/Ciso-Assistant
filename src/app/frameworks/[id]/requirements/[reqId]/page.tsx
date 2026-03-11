import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ExternalLink, Shield } from 'lucide-react';
import { getFrameworkServer, getFrameworksServer } from '@/lib/data-loader-server';
import { findRequirementById } from '@/lib/data-loader';
import { getServerLanguage } from '@/lib/server-language';
import { normalizeRequirementForView } from '@/lib/framework-presentation';
import FrameworkHeader from '@/components/FrameworkHeader';
import FrameworkSidebar from '@/components/FrameworkSidebar';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string; reqId: string };
}

export default async function RequirementPage({ params }: Props) {
  const lang = getServerLanguage();
  const isZh = lang === 'zh';
  const [framework, allFrameworks] = await Promise.all([
    getFrameworkServer(params.id, lang),
    getFrameworksServer(lang)
  ]);

  if (!framework) {
    notFound();
  }

  const result = findRequirementById(framework, params.reqId);
  if (!result) {
    notFound();
  }

  const { requirement, category, subcategory } = result;
  const normalizedRequirement = normalizeRequirementForView(requirement);
  const siblingRequirements = subcategory.requirements
    .filter((item) => item.questionType !== 'rubric')
    .map((item) => normalizeRequirementForView(item));
  const backToListHref = `/frameworks/${framework.id}?category=${encodeURIComponent(category.id)}&subcategory=${encodeURIComponent(
    subcategory.id
  )}`;

  return (
    <div className="min-h-screen px-4 pb-6">
      <div className="max-w-[1680px] mx-auto pt-6">
        <div className="rounded-2xl border border-slate-200 bg-white/85 shadow-lg overflow-hidden animate-rise-in">
          <header className="h-14 border-b border-slate-200 flex items-center px-4 bg-white/90 backdrop-blur shrink-0">
            <div className="flex items-center gap-2 mr-6">
              <div className="w-8 h-8 bg-cyan-700 rounded-md flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-slate-800 text-sm md:text-base truncate">
                {isZh ? 'CISO助手' : 'Ciso-Assistant'}
              </span>
            </div>
            <FrameworkHeader frameworkId={framework.id} totalRequirements={framework.stats?.totalRequirements || 0} />
          </header>

          <div className="flex h-[calc(100vh-9rem)] min-h-[620px] overflow-hidden">
            <FrameworkSidebar
              framework={framework}
              allFrameworks={allFrameworks}
              selectedCategoryId={category.id}
              selectedSubcategoryId={subcategory.id}
            />

            <main className="flex-1 flex flex-col min-w-0 bg-white/60">
              <div className="border-b border-slate-200 px-5 py-4 bg-gradient-to-r from-white via-cyan-50/40 to-white shrink-0">
                <div className="text-xs text-slate-500 mb-2">
                  {category.code} {category.name} / {subcategory.code} {subcategory.name}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-slate-500">{normalizedRequirement.code}</span>
                  <Shield className="w-5 h-5 text-cyan-700" />
                  <h1 className="text-lg md:text-xl font-semibold text-slate-900">{normalizedRequirement.name}</h1>
                </div>
              </div>

              <div className="h-10 border-b border-slate-200 flex items-center justify-between px-5 text-sm text-slate-600 shrink-0 bg-white">
                <span className="truncate">
                  {isZh
                    ? '左侧保留框架导航，右侧仅展示当前末级控制项。'
                    : 'Framework navigation remains on the left; only final control content is shown on the right.'}
                </span>
                <Link href={backToListHref} className="ml-4 text-xs text-cyan-700 hover:text-cyan-800 whitespace-nowrap">
                  {isZh ? '返回子分类列表' : 'Back to subcategory list'}
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {siblingRequirements.length > 1 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex gap-2 overflow-x-auto">
                      {siblingRequirements.map((item) => (
                        <Link
                          key={item.id}
                          href={`/frameworks/${framework.id}/requirements/${item.id}`}
                          className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium ${
                            item.id === requirement.id
                              ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {item.code}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <article className="bg-white rounded-xl border border-slate-200 p-6">
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{normalizedRequirement.description}</p>

                  {normalizedRequirement.verification && (
                    <div className="bg-cyan-50 rounded-lg p-4 mt-5">
                      <h2 className="text-sm font-semibold text-cyan-900 mb-2 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {isZh ? '验证方法' : 'Verification'}
                      </h2>
                      <p className="text-cyan-800 text-sm">{normalizedRequirement.verification}</p>
                    </div>
                  )}
                </article>

                {(normalizedRequirement.cwe || normalizedRequirement.nist) && (
                  <section className="bg-white rounded-xl border border-slate-200 p-5">
                    <h2 className="text-sm font-semibold text-slate-900 mb-3">{isZh ? '参考标准' : 'References'}</h2>
                    <div className="flex flex-wrap gap-2">
                      {normalizedRequirement.cwe && (
                        <a
                          href={`https://cwe.mitre.org/data/definitions/${normalizedRequirement.cwe}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm hover:bg-violet-200 transition-colors"
                        >
                          CWE-{normalizedRequirement.cwe}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      )}
                      {normalizedRequirement.nist && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                          NIST {normalizedRequirement.nist}
                        </span>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const framework = await getFrameworkServer(params.id);
  if (!framework) return { title: 'Requirement Not Found' };

  const result = findRequirementById(framework, params.reqId);
  return {
    title: result
      ? `${result.requirement.code} - ${result.requirement.name} - Ciso-Assistant`
      : 'Requirement Not Found'
  };
}
