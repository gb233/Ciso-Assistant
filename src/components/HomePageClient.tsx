'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Compass,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { FrameworkMeta } from '@/lib/data-loader';

interface HomePageClientProps {
  frameworks: FrameworkMeta[];
  totalRequirements: number;
}

interface ResumeAssessment {
  frameworkId: string;
  frameworkName: string;
  assessedCount: number;
  totalRequirements: number;
  completionRate: number;
  updatedAt: number;
}

interface StoredAssessment {
  updatedAt?: string;
}

interface StoredFrameworkAssessment {
  assessments?: Record<string, StoredAssessment>;
}

const STORAGE_KEY = 'security-framework-assessments';

export default function HomePageClient({ frameworks, totalRequirements }: HomePageClientProps) {
  const { t, language } = useLanguage();
  const isZh = language === 'zh';
  const [resumeAssessment, setResumeAssessment] = useState<ResumeAssessment | null>(null);

  const chineseFrameworks = frameworks.filter((item) => item.region === 'cn').length;
  const globalFrameworks = frameworks.length - chineseFrameworks;

  const topFrameworks = useMemo(
    () => [...frameworks].sort((a, b) => b.requirements - a.requirements).slice(0, 6),
    [frameworks]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, StoredFrameworkAssessment>;
      const candidates: ResumeAssessment[] = [];

      for (const [frameworkId, snapshot] of Object.entries(parsed)) {
        const entries = Object.values(snapshot.assessments || {});
        if (entries.length === 0) continue;

        const meta = frameworks.find((framework) => framework.id === frameworkId);
        if (!meta) continue;

        const latestUpdate = entries.reduce((latest, item) => {
          const timestamp = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
          return Math.max(latest, timestamp);
        }, 0);

        const assessedCount = entries.length;
        const completionRate = meta.requirements > 0 ? Math.round((assessedCount / meta.requirements) * 100) : 0;

        candidates.push({
          frameworkId,
          frameworkName: meta.name,
          assessedCount,
          totalRequirements: meta.requirements,
          completionRate,
          updatedAt: latestUpdate,
        });
      }

      if (candidates.length === 0) return;
      candidates.sort((a, b) => b.updatedAt - a.updatedAt);
      setResumeAssessment(candidates[0]);
    } catch {
      setResumeAssessment(null);
    }
  }, [frameworks]);

  const actionCards = isZh
    ? [
        {
          title: '开始框架评估',
          desc: '从已有框架直接打分并记录证据。',
          href: '/frameworks/owasp-samm',
          icon: ShieldCheck,
        },
        {
          title: '查看评估报告',
          desc: '汇总已评估控制项并导出报告。',
          href: '/frameworks/owasp-samm/report',
          icon: BarChart3,
        },
        {
          title: '全局搜索控制项',
          desc: '按关键词快速定位可复用要求。',
          href: '/search',
          icon: Search,
        },
      ]
    : [
        {
          title: 'Start Framework Assessment',
          desc: 'Score controls and capture evidence directly.',
          href: '/frameworks/owasp-samm',
          icon: ShieldCheck,
        },
        {
          title: 'Open Report',
          desc: 'Review assessed controls and export a report.',
          href: '/frameworks/owasp-samm/report',
          icon: BarChart3,
        },
        {
          title: 'Search Controls',
          desc: 'Locate reusable requirements by keyword.',
          href: '/search',
          icon: Search,
        },
      ];

  const workflowCards = isZh
    ? [
        {
          step: '01',
          title: '定义基线',
          duration: '5-10 分钟',
          desc: '选择一个目标框架，完成首轮要求评估，形成组织当前基线。',
          href: '/frameworks',
        },
        {
          step: '02',
          title: '执行评估',
          duration: '10 分钟',
          desc: '在框架页逐项完成评估并记录证据，形成当前状态基线。',
          href: '/frameworks/owasp-samm',
        },
        {
          step: '03',
          title: '产出报告',
          duration: '2 分钟',
          desc: '导出 JSON / CSV 评估结果，用于审计汇报和季度改进计划。',
          href: '/frameworks/owasp-samm/report',
        },
      ]
    : [
        {
          step: '01',
          title: 'Set Baseline',
          duration: '5-10 min',
          desc: 'Choose a framework and complete the first-pass assessment baseline.',
          href: '/frameworks',
        },
        {
          step: '02',
          title: 'Run Assessment',
          duration: '10 min',
          desc: 'Assess each control on the framework page and capture evidence.',
          href: '/frameworks/owasp-samm',
        },
        {
          step: '03',
          title: 'Export Report',
          duration: '2 min',
          desc: 'Export JSON/CSV evidence pack for audit and remediation planning.',
          href: '/frameworks/owasp-samm/report',
        },
      ];

  return (
    <div className="min-h-screen pb-16">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 animate-rise-in">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3 rounded-full border border-cyan-200 bg-white/80 backdrop-blur px-4 py-2 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center animate-pulse-glow">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-slate-800">{t.common.appName}</span>
          </div>
          <LanguageSwitcher variant="button" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <section className="rounded-3xl border border-slate-200 bg-white/85 shadow-lg overflow-hidden animate-rise-in">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 sm:p-10 lg:p-12 surface-grid">
              <p className="text-xs tracking-[0.12em] uppercase text-cyan-700 font-semibold mb-3">
                {isZh ? '任务驱动的合规工作台' : 'Task-Driven Compliance Workspace'}
              </p>
              <h1 className="text-4xl sm:text-5xl font-semibold text-slate-900 mb-4 text-balance">
                {isZh ? 'CISO助手' : 'Ciso-Assistant'}
              </h1>
              <p className="text-slate-600 text-base sm:text-lg max-w-2xl mb-7 text-balance">{t.common.appDescription}</p>

              <div className="grid grid-cols-2 gap-3 mb-7">
                <div className="rounded-xl bg-slate-900 text-white px-4 py-3">
                  <div className="text-2xl font-semibold">{frameworks.length}</div>
                  <div className="text-xs text-slate-300 mt-1">{isZh ? '框架总数' : 'Frameworks'}</div>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
                  <div className="text-2xl font-semibold text-slate-900">{totalRequirements}+</div>
                  <div className="text-xs text-slate-500 mt-1">{isZh ? '要求总数' : 'Requirements'}</div>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
                  <div className="text-2xl font-semibold text-slate-900">{chineseFrameworks}</div>
                  <div className="text-xs text-slate-500 mt-1">{isZh ? '中国标准' : 'China Standards'}</div>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
                  <div className="text-2xl font-semibold text-slate-900">{globalFrameworks}</div>
                  <div className="text-xs text-slate-500 mt-1">{isZh ? '国际标准' : 'Global Standards'}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/frameworks"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-700 text-white hover:bg-cyan-800 transition"
                >
                  <Compass className="w-4 h-4" />
                  {isZh ? '进入框架中心' : 'Open Framework Hub'}
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50 transition"
                >
                  <Search className="w-4 h-4" />
                  {isZh ? '搜索控制项' : 'Search Controls'}
                </Link>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 p-8 sm:p-10 lg:p-12">
              <h2 className="text-lg font-semibold mb-2">{isZh ? '快速开始' : 'Quick Start'}</h2>
              <p className="text-sm text-slate-300 mb-5">
                {isZh ? '按工作任务进入，而不是先浏览全部内容。' : 'Start by workflow tasks instead of browsing everything first.'}
              </p>
              <div className="space-y-3">
                {actionCards.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.title}
                      href={action.href}
                      className="block rounded-xl border border-slate-700 bg-slate-800/60 p-4 hover:border-cyan-400 transition animate-rise-in"
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-cyan-600/20 text-cyan-300 flex items-center justify-center mt-0.5">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-100">{action.title}</div>
                          <div className="text-sm text-slate-300 mt-1">{action.desc}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="animate-rise-in" style={{ animationDelay: '80ms' }}>
          <div className="flex items-end justify-between mb-4 gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{isZh ? '任务流' : 'Workflow'}</h2>
              <p className="text-sm text-slate-600 mt-1">
                {isZh
                  ? '从基线评估到报告导出，按照可执行顺序推进。'
                  : 'Move from baseline assessment to final report export.'}
              </p>
            </div>
            <Link href="/frameworks" className="text-sm text-cyan-700 hover:text-cyan-900 inline-flex items-center gap-1">
              {isZh ? '查看全部框架' : 'Browse all frameworks'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workflowCards.map((item, index) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-white/85 p-5 hover:border-cyan-300 hover:shadow-md transition animate-rise-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-xs font-medium text-cyan-700 mb-2">STEP {item.step}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-xs text-slate-500 mb-3">{item.duration}</p>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-rise-in" style={{ animationDelay: '120ms' }}>
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white/85 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {isZh ? '继续工作' : 'Continue Working'}
            </h2>

            {resumeAssessment ? (
              <div className="rounded-xl bg-slate-900 text-white p-5">
                <div className="text-sm text-slate-300 mb-1">{isZh ? '最近一次评估' : 'Latest Assessment'}</div>
                <h3 className="text-xl font-semibold mb-3">{resumeAssessment.frameworkName}</h3>
                <div className="h-2 rounded-full bg-slate-700 overflow-hidden mb-2">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${Math.min(100, resumeAssessment.completionRate)}%` }}
                  />
                </div>
                <p className="text-sm text-slate-300 mb-4">
                  {resumeAssessment.assessedCount}/{resumeAssessment.totalRequirements}{' '}
                  {isZh ? '项要求已评估' : 'requirements assessed'} ({resumeAssessment.completionRate}%)
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/frameworks/${resumeAssessment.frameworkId}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {isZh ? '继续评估' : 'Resume Assessment'}
                  </Link>
                  <Link
                    href={`/frameworks/${resumeAssessment.frameworkId}/report`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-500 hover:bg-slate-800"
                  >
                    <BarChart3 className="w-4 h-4" />
                    {isZh ? '查看报告' : 'Open Report'}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-slate-600 mb-3">
                  {isZh
                    ? '尚未检测到历史评估记录，建议先从一个框架开始建立基线。'
                    : 'No local assessment history detected yet. Start with one baseline framework.'}
                </p>
                <Link
                  href="/frameworks/owasp-samm"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-700 text-white hover:bg-cyan-800"
                >
                  <PlayCircle className="w-4 h-4" />
                  {isZh ? '开始首次评估' : 'Start First Assessment'}
                </Link>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white/85 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">{isZh ? '框架聚焦' : 'Framework Spotlight'}</h2>
            <div className="space-y-3">
              {topFrameworks.map((framework, index) => (
                <Link
                  key={framework.id}
                  href={`/frameworks/${framework.id}`}
                  className="block rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-800">#{index + 1} {framework.name}</span>
                    <span className="text-slate-500">{framework.requirements}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-cyan-600"
                      style={{ width: `${Math.min(100, Math.round((framework.requirements / topFrameworks[0].requirements) * 100))}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
