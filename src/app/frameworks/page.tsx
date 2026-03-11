import Link from 'next/link';
import { getFrameworksServer } from '@/lib/data-loader-server';
import {
  Shield,
  BookOpen,
  Lock,
  Globe,
  Filter,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { getServerLanguage } from '@/lib/server-language';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export const dynamic = 'force-dynamic';

export default async function FrameworksPage() {
  const lang = getServerLanguage();
  const isZh = lang === 'zh';
  const frameworks = await getFrameworksServer(lang);

  const byType = frameworks.reduce((acc, fw) => {
    acc[fw.type] = acc[fw.type] || [];
    acc[fw.type].push(fw);
    return acc;
  }, {} as Record<string, typeof frameworks>);

  const byRegion = frameworks.reduce((acc, fw) => {
    const region = fw.region === 'cn' ? 'cn' : 'global';
    acc[region] = acc[region] || [];
    acc[region].push(fw);
    return acc;
  }, {} as Record<string, typeof frameworks>);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'standard':
        return <BookOpen className="w-4 h-4" />;
      case 'maturity':
        return <Shield className="w-4 h-4" />;
      case 'control':
        return <Lock className="w-4 h-4" />;
      case 'compliance':
      case 'regulation':
        return <Globe className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, { zh: string; en: string }> = {
      standard: { zh: '技术标准', en: 'Standard' },
      maturity: { zh: '成熟度模型', en: 'Maturity Model' },
      control: { zh: '控制框架', en: 'Control Framework' },
      compliance: { zh: '合规框架', en: 'Compliance Framework' },
      regulation: { zh: '法规', en: 'Regulation' },
    };
    return labels[type] ? labels[type][lang] : type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      standard: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      maturity: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      control: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      compliance: 'bg-amber-50 text-amber-700 border-amber-200',
      regulation: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return colors[type] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const totalRequirements = frameworks.reduce((sum, framework) => sum + framework.requirements, 0);

  const stats = [
    { label: isZh ? '框架总量' : 'Frameworks', value: frameworks.length, style: 'bg-slate-900 text-white' },
    { label: isZh ? '要求总量' : 'Requirements', value: `${totalRequirements}+`, style: 'bg-white text-slate-900' },
    { label: isZh ? '中国标准' : 'China Standards', value: byRegion.cn?.length || 0, style: 'bg-white text-slate-900' },
    { label: isZh ? '国际标准' : 'Global Standards', value: byRegion.global?.length || 0, style: 'bg-white text-slate-900' },
  ];

  return (
    <div className="min-h-screen pb-12">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 animate-rise-in">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 backdrop-blur px-4 py-2 text-sm text-slate-700">
            <Link href="/" className="hover:text-slate-900">{isZh ? '首页' : 'Home'}</Link>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-900">{isZh ? '框架中心' : 'Framework Hub'}</span>
          </div>
          <LanguageSwitcher variant="button" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-white/85 shadow-lg overflow-hidden animate-rise-in">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-8 sm:p-10 surface-grid">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-100 text-cyan-800 px-3 py-1 text-xs font-medium mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                {isZh ? '任务导向框架入口' : 'Task-Oriented Framework Entry'}
              </div>
              <h1 className="text-4xl sm:text-5xl font-semibold text-slate-900 mb-4 text-balance">
                {isZh ? '安全框架总览' : 'Security Framework Overview'}
              </h1>
              <p className="text-slate-600 text-base sm:text-lg max-w-3xl mb-6">
                {isZh
                  ? '按地域与类型浏览全部框架，优先进入评估和报告工作流。'
                  : 'Browse all frameworks by region and type, then jump directly into assessment and reporting workflows.'}
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map((item) => (
                  <div key={item.label} className={`rounded-xl border border-slate-200 px-4 py-3 ${item.style}`}>
                    <div className="text-2xl font-semibold">{item.value}</div>
                    <div className={`text-xs mt-1 ${item.style.includes('text-white') ? 'text-slate-300' : 'text-slate-500'}`}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 p-8 sm:p-10">
              <h2 className="text-lg font-semibold mb-2">{isZh ? '快速动作' : 'Quick Actions'}</h2>
              <p className="text-sm text-slate-300 mb-5">
                {isZh
                  ? '选择一个直接进入的任务路径。'
                  : 'Pick one direct workflow path to continue.'}
              </p>
              <div className="space-y-3 text-sm">
                <Link
                  href="/frameworks/owasp-samm"
                  className="block rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 hover:border-cyan-400"
                >
                  {isZh ? '开始框架评估' : 'Start Framework Assessment'}
                </Link>
                <Link
                  href="/frameworks/owasp-samm/report"
                  className="block rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 hover:border-cyan-400"
                >
                  {isZh ? '查看评估报告' : 'Open Assessment Report'}
                </Link>
                <Link
                  href="/search"
                  className="block rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 hover:border-cyan-400"
                >
                  {isZh ? '全局搜索控制项' : 'Search Controls Globally'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {(['cn', 'global'] as const).map((regionKey, sectionIndex) => {
          const regionFrameworks = byRegion[regionKey] || [];
          if (regionFrameworks.length === 0) return null;

          return (
            <section
              key={regionKey}
              className="rounded-2xl border border-slate-200 bg-white/85 p-5 sm:p-6 animate-rise-in"
              style={{ animationDelay: `${sectionIndex * 90}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  {regionKey === 'cn' ? (
                    <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-semibold text-sm">中</span>
                  ) : (
                    <span className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </span>
                  )}
                  {regionKey === 'cn' ? (isZh ? '中国标准域' : 'China Standards') : (isZh ? '国际标准域' : 'Global Standards')}
                </h2>
                <span className="text-sm text-slate-500">{regionFrameworks.length}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {regionFrameworks.map((framework) => (
                  <Link
                    key={framework.id}
                    href={`/frameworks/${framework.id}`}
                    className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-cyan-300 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${getTypeColor(framework.type)}`}>
                        {getTypeIcon(framework.type)}
                        {getTypeLabel(framework.type)}
                      </div>
                      <span className="text-xs text-slate-500">v{framework.version}</span>
                    </div>

                    <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-cyan-800 transition-colors">
                      {framework.name}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-4">{framework.description}</p>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{framework.requirements} {isZh ? '项要求' : 'requirements'}</span>
                      <span className="inline-flex items-center text-cyan-700 group-hover:text-cyan-900">
                        {isZh ? '进入' : 'Open'}
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <section className="rounded-2xl border border-slate-200 bg-white/85 p-5 sm:p-6 animate-rise-in" style={{ animationDelay: '140ms' }}>
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-700" />
            {isZh ? '按类型聚合' : 'Grouped by Type'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byType).map(([type, typeFrameworks]) => (
              <div
                key={type}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${getTypeColor(type)}`}
              >
                {getTypeIcon(type)}
                <span>{getTypeLabel(type)}</span>
                <span className="opacity-70">{typeFrameworks.length}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
