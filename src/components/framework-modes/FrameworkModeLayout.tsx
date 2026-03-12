import FrameworkSidebar from '@/components/FrameworkSidebar';
import RequirementList from '@/components/RequirementList';
import FrameworkHeader from '@/components/FrameworkHeader';
import { getFrameworkRequirementSummary } from '@/lib/framework-presentation';
import type { FrameworkModeViewProps } from './types';

interface ModeLayoutCopy {
  modeTagZh: string;
  modeTagEn: string;
  defaultStatusZh?: string;
  defaultStatusEn?: string;
  introTitleZh?: string;
  introTitleEn?: string;
  introTextZh?: string;
  introTextEn?: string;
  legendItemsZh?: string[];
  legendItemsEn?: string[];
  headerGradientClassName: string;
  statusStripClassName?: string;
  modeTagClassName: string;
}

interface FrameworkModeLayoutProps extends FrameworkModeViewProps {
  copy: ModeLayoutCopy;
}

export default function FrameworkModeLayout({
  framework,
  allFrameworks,
  filteredRequirements,
  allRequirementsCount,
  selectedCategory,
  selectedSubcategory,
  hasFilter,
  isZh,
  presentationProfile,
  copy,
}: FrameworkModeLayoutProps) {
  const summary = getFrameworkRequirementSummary(framework);
  const coverageStatus = framework.coverage?.status || 'unknown';
  const expectedTotal = framework.coverage?.expectedRequirements;
  const coverageLabel = coverageStatus === 'partial'
    ? (isZh ? '部分覆盖' : 'Partial')
    : coverageStatus === 'full'
      ? (isZh ? '完整覆盖' : 'Full')
      : (isZh ? '未标注' : 'Unspecified');

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

            <FrameworkHeader frameworkId={framework.id} totalRequirements={allRequirementsCount} />
          </header>

          <div className="flex h-[calc(100vh-9rem)] min-h-[620px] overflow-hidden">
            <FrameworkSidebar
              framework={framework}
              allFrameworks={allFrameworks}
              selectedCategoryId={selectedCategory?.id}
              selectedSubcategoryId={selectedSubcategory?.id}
            />

            <main className="flex-1 flex flex-col min-w-0 bg-white/60">
              <div className={`border-b border-slate-200 px-5 py-4 shrink-0 ${copy.headerGradientClassName}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cyan-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white font-bold text-sm">{framework.id.slice(0, 4).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-lg md:text-xl font-semibold text-slate-900 text-balance">
                        {framework.fullName} {framework.version}
                      </h1>
                      <span
                        className={`px-2 py-0.5 text-[11px] rounded-full border whitespace-nowrap ${copy.modeTagClassName}`}
                      >
                        {isZh ? copy.modeTagZh : copy.modeTagEn}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{framework.description}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>{isZh ? '版本' : 'Version'}: {framework.version}</span>
                      <span className="text-slate-300">•</span>
                      <span>
                        {isZh ? '覆盖状态' : 'Coverage'}: {coverageLabel}
                        {typeof expectedTotal === 'number' && expectedTotal > 0 && (
                          <span className="text-slate-400"> ({summary.totalCount}/{expectedTotal})</span>
                        )}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        {isZh ? '控制项/量表/总计' : 'Controls/Rubrics/Total'}:{' '}
                        <span className="font-medium text-slate-700">
                          {summary.controlCount}/{summary.rubricCount}/{summary.totalCount}
                        </span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        {isZh ? '当前展示' : 'Visible'}: {filteredRequirements.length}
                        <span className="text-slate-400"> / {allRequirementsCount}</span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>{framework.categories.length} {isZh ? '个分类' : 'categories'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <RequirementList
                requirements={filteredRequirements}
                frameworkId={framework.id}
                frameworkInfo={{
                  id: framework.id,
                  name: framework.name,
                  fullName: framework.fullName,
                  version: framework.version,
                  type: framework.type,
                  domain: framework.domain,
                  presentationMode: presentationProfile.mode,
                }}
                enableAssessment={true}
                totalRequirements={allRequirementsCount}
                presentationProfile={presentationProfile}
              />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
