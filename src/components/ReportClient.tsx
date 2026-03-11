'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Download, BarChart3, PieChart, TrendingUp, AlertCircle, Target, Calendar, Shield, Sparkles } from 'lucide-react';
import type { Framework, Requirement } from '@/lib/data-loader';
import { useLanguage } from './LanguageProvider';
import AIAssessmentAssistant from './AIAssessmentAssistant';
import {
  ASSESSMENT_STORAGE_KEY,
  getAssessmentBandFromScore,
  getAssessmentScore,
  isRequirementAssessed,
  normalizeAssessmentData,
  type AssessmentData,
  type AssessmentStatus,
} from '@/lib/assessment-model';

interface ReportClientProps {
  framework: Framework;
  requirements: Array<Requirement & { categoryName: string; subcategoryName: string }>;
}

interface AssessmentReport {
  assessedCount: number;
  totalRequirements: number;
  completionRate: number;
  assessmentStatusDistribution: Record<AssessmentStatus, number>;
  averageAssessmentScore: number;
  maturityLevel: string;
  assessedRequirements: Array<{
    requirement: Requirement & { categoryName: string; subcategoryName: string };
    assessment: AssessmentData;
  }>;
}

const statusColors: Record<AssessmentStatus, string> = {
  UNASSESSED: 'bg-gray-100 text-gray-600',
  NOT_APPLICABLE: 'bg-slate-100 text-slate-700',
  NOT_STARTED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  IMPLEMENTED: 'bg-cyan-100 text-cyan-700',
  VERIFIED_EFFECTIVE: 'bg-green-100 text-green-700',
};

export default function ReportClient({ framework, requirements }: ReportClientProps) {
  const { language, t } = useLanguage();
  const isZh = language === 'zh';
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const assessmentStatusLabels: Record<AssessmentStatus, string> = isZh
    ? {
        UNASSESSED: '未评估',
        NOT_APPLICABLE: '不适用',
        NOT_STARTED: '未启动',
        IN_PROGRESS: '进行中',
        IMPLEMENTED: '已实施',
        VERIFIED_EFFECTIVE: '已验证有效',
      }
    : {
        UNASSESSED: 'Unassessed',
        NOT_APPLICABLE: 'Not Applicable',
        NOT_STARTED: 'Not Started',
        IN_PROGRESS: 'In Progress',
        IMPLEMENTED: 'Implemented',
        VERIFIED_EFFECTIVE: 'Verified Effective',
      };

  const maturityLabel = (averageScore: number) => {
    const band = getAssessmentBandFromScore(averageScore);
    if (isZh) {
      if (band === 'initial') return '初始级';
      if (band === 'developing') return '发展级';
      if (band === 'managed') return '管理级';
      return '优化级';
    }
    if (band === 'initial') return 'Initial';
    if (band === 'developing') return 'Developing';
    if (band === 'managed') return 'Managed';
    return 'Optimized';
  };

  const generateReport = useCallback(() => {
    try {
      const stored = localStorage.getItem(ASSESSMENT_STORAGE_KEY);
      const rawAssessments = stored
        ? (JSON.parse(stored)[framework.id]?.assessments || {})
        : {};

      const normalizedAssessments: Record<string, AssessmentData> = {};
      Object.entries(rawAssessments).forEach(([reqId, value]) => {
        normalizedAssessments[reqId] = normalizeAssessmentData(value);
      });

      const assessedRequirements = Object.entries(normalizedAssessments)
        .filter(([, assessment]) => isRequirementAssessed(assessment))
        .map(([reqId, assessment]) => {
          const req = requirements.find(r => r.id === reqId);
          return req ? { requirement: req, assessment } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const assessedCount = assessedRequirements.length;
      const totalRequirements = requirements.length;
      const completionRate = totalRequirements > 0
        ? Math.round((assessedCount / totalRequirements) * 100)
        : 0;

      const assessmentStatusDistribution: Record<AssessmentStatus, number> = {
        UNASSESSED: 0,
        NOT_APPLICABLE: 0,
        NOT_STARTED: 0,
        IN_PROGRESS: 0,
        IMPLEMENTED: 0,
        VERIFIED_EFFECTIVE: 0,
      };
      let totalScore = 0;
      let scoredCount = 0;

      assessedRequirements.forEach(({ assessment }) => {
        assessmentStatusDistribution[assessment.assessmentStatus] += 1;
        const score = getAssessmentScore(assessment.assessmentStatus);
        if (score !== null) {
          totalScore += score;
          scoredCount += 1;
        }
      });
      assessmentStatusDistribution.UNASSESSED = Math.max(totalRequirements - assessedCount, 0);

      const averageAssessmentScore = scoredCount > 0 ? (totalScore / scoredCount) : 0;

      setReport({
        assessedCount,
        totalRequirements,
        completionRate,
        assessmentStatusDistribution,
        averageAssessmentScore: Math.round(averageAssessmentScore * 10) / 10,
        maturityLevel: maturityLabel(averageAssessmentScore),
        assessedRequirements
      });
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsLoading(false);
    }
  }, [framework.id, requirements, isZh]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const handleExportJSON = () => {
    if (!report) return;

    const exportData = {
      framework: {
        id: framework.id,
        name: framework.name,
        version: framework.version
      },
      generatedAt: new Date().toISOString(),
      summary: {
        completionRate: report.completionRate,
        averageAssessmentScore: report.averageAssessmentScore,
        maturityLevel: report.maturityLevel,
        assessedCount: report.assessedCount,
        totalRequirements: report.totalRequirements
      },
      assessmentStatusDistribution: report.assessmentStatusDistribution,
      assessedRequirements: report.assessedRequirements.map(({ requirement, assessment }) => ({
        id: requirement.id,
        code: requirement.code,
        name: requirement.name,
        category: requirement.categoryName,
        subcategory: requirement.subcategoryName,
        ...(requirement.level ? { tag: requirement.level } : {}),
        assessmentStatus: assessment.assessmentStatus,
        notes: assessment.notes,
        assessedAt: assessment.updatedAt
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${framework.id}-assessment-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!report) return;

    const headers = isZh
      ? ['代码', '名称', '分类', '子分类', '标签', '评估状态', '备注', '评估时间']
      : ['Code', 'Name', 'Category', 'Subcategory', 'Tag', 'Assessment Status', 'Notes', 'Assessed At'];

    const rows = report.assessedRequirements.map(({ requirement, assessment }) => [
      requirement.code,
      requirement.name,
      requirement.categoryName,
      requirement.subcategoryName,
      requirement.level || '',
      assessmentStatusLabels[assessment.assessmentStatus],
      assessment.notes.replace(/"/g, '""'),
      new Date(assessment.updatedAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${framework.id}-assessment-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">{isZh ? '生成报告中...' : 'Generating report...'}</span>
      </div>
    );
  }

  if (!report || report.assessedCount === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{isZh ? '暂无评估数据' : 'No assessment data yet'}</h3>
        <p className="text-gray-600 mb-6">
          {isZh
            ? '您还没有对任何要求进行评估。开始评估后，报告将在此处显示。'
            : 'You have not assessed any requirements yet. Start an assessment to generate the report.'}
        </p>
        <Link
          href={`/frameworks/${framework.id}`}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Target className="w-4 h-4 mr-2" />
          {isZh ? '开始评估' : 'Start Assessment'}
        </Link>
      </div>
    );
  }

  const distributionOrder: AssessmentStatus[] = [
    'VERIFIED_EFFECTIVE',
    'IMPLEMENTED',
    'IN_PROGRESS',
    'NOT_STARTED',
    'NOT_APPLICABLE',
    'UNASSESSED',
  ];

  const assistantRequirements = report.assessedRequirements.map(({ requirement, assessment }) => ({
    id: requirement.id,
    code: requirement.code,
    name: requirement.name,
    categoryName: requirement.categoryName,
    subcategoryName: requirement.subcategoryName,
    assessmentStatus: assessment.assessmentStatus,
    notes: assessment.notes,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-3 flex-wrap">
        <button
          onClick={() => setShowAIAssistant((prev) => !prev)}
          className={`inline-flex items-center px-4 py-2 rounded-lg border ${
            showAIAssistant
              ? 'bg-cyan-700 border-cyan-700 text-white hover:bg-cyan-800'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isZh ? 'AI 安全专家' : 'AI Security Expert'}
        </button>
        <button
          onClick={handleExportJSON}
          className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          <Download className="w-4 h-4 mr-2" />
          {t.report.exportJSON}
        </button>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          <Download className="w-4 h-4 mr-2" />
          {t.report.exportCSV}
        </button>
      </div>

      {showAIAssistant && (
        <AIAssessmentAssistant
          isZh={isZh}
          framework={{
            id: framework.id,
            name: framework.name,
            version: framework.version,
            type: framework.type,
            domain: framework.domain,
          }}
          summary={{
            assessedCount: report.assessedCount,
            totalRequirements: report.totalRequirements,
            completionRate: report.completionRate,
            averageAssessmentScore: report.averageAssessmentScore,
            maturityLevel: report.maturityLevel,
          }}
          assessmentStatusDistribution={report.assessmentStatusDistribution}
          assessedRequirements={assistantRequirements}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">{t.framework.completionRate}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{report.completionRate}%</div>
          <div className="text-sm text-gray-500">{report.assessedCount} / {report.totalRequirements} {isZh ? '要求' : 'requirements'}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-cyan-600" />
            </div>
            <span className="text-sm text-gray-500">{isZh ? '评估状态指数' : 'Assessment Status Index'}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{report.averageAssessmentScore}</div>
          <div className="text-sm text-gray-500">{isZh ? '满分 3.0' : 'Out of 3.0'}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">{t.framework.maturityLevel}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{report.maturityLevel}</div>
          <div className="text-sm text-gray-500">{isZh ? '基于评估状态' : 'Based on assessment status'}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">{t.assessment.lastUpdated}</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {report.assessedRequirements.length > 0
              ? new Date(Math.max(...report.assessedRequirements.map(r => new Date(r.assessment.updatedAt).getTime()))).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')
              : '-'}
          </div>
          <div className="text-sm text-gray-500">{t.assessment.assessmentDate}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <PieChart className="w-5 h-5 mr-2 text-blue-600" />
          {isZh ? '评估状态分布' : 'Assessment Status Distribution'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {distributionOrder.map((status) => (
            <div key={status} className={`p-4 rounded-lg ${statusColors[status]}`}>
              <div className="text-2xl font-bold">{report.assessmentStatusDistribution[status]}</div>
              <div className="text-sm">{assessmentStatusLabels[status]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 text-amber-600" />
          {t.report.improvementSuggestions}
        </h3>
        <div className="space-y-3">
          {report.averageAssessmentScore < 1 && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="font-medium text-red-900">{isZh ? '执行基础薄弱' : 'Execution baseline is weak'}</div>
              <p className="text-sm text-red-700 mt-1">
                {isZh
                  ? '建议优先把未启动项推进为进行中，并逐步完成核心要求。'
                  : 'Prioritize moving not-started items into in-progress, then complete core requirements.'}
              </p>
            </div>
          )}
          {report.averageAssessmentScore >= 1 && report.averageAssessmentScore < 2 && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="font-medium text-amber-900">{isZh ? '需要持续推进' : 'Steady execution needed'}</div>
              <p className="text-sm text-amber-700 mt-1">
                {isZh
                  ? '建议聚焦“进行中”项转“已实施”，提高评估覆盖率。'
                  : 'Focus on converting in-progress items to implemented and increase coverage.'}
              </p>
            </div>
          )}
          {report.averageAssessmentScore >= 2 && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="font-medium text-green-900">{isZh ? '整体表现良好' : 'Strong overall execution'}</div>
              <p className="text-sm text-green-700 mt-1">
                {isZh
                  ? '建议持续把“已实施”项推进到“已验证有效”。'
                  : 'Continue moving implemented items toward verified effective.'}
              </p>
            </div>
          )}
          {report.completionRate < 60 && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="font-medium text-blue-900">{isZh ? '评估覆盖率偏低' : 'Assessment coverage is low'}</div>
              <p className="text-sm text-blue-700 mt-1">
                {isZh
                  ? `当前仅评估了 ${report.completionRate}% 的要求，建议补齐关键分类的评估覆盖。`
                  : `Only ${report.completionRate}% of requirements are assessed; expand coverage across key categories.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
