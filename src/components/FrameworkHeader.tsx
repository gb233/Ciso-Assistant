'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useLanguage } from './LanguageProvider';
import LanguageSwitcher from './LanguageSwitcher';
import {
  ASSESSMENT_STORAGE_KEY,
  isRequirementAssessed,
  normalizeAssessmentData,
} from '@/lib/assessment-model';

interface FrameworkHeaderProps {
  frameworkId: string;
  totalRequirements: number;
}

interface ProgressData {
  assessedCount: number;
  completionRate: number;
}

export default function FrameworkHeader({ frameworkId, totalRequirements }: FrameworkHeaderProps) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState<ProgressData>({
    assessedCount: 0,
    completionRate: 0
  });

  useEffect(() => {
    // Load progress from localStorage
    const loadProgress = () => {
      try {
        const stored = localStorage.getItem(ASSESSMENT_STORAGE_KEY);
        if (stored) {
          const allAssessments = JSON.parse(stored);
          const frameworkData = allAssessments[frameworkId];
          if (frameworkData?.assessments) {
            const assessedCount = Object.values(frameworkData.assessments)
              .map((assessment) => normalizeAssessmentData(assessment))
              .filter(isRequirementAssessed)
              .length;
            const completionRate = totalRequirements > 0
              ? Math.round((assessedCount / totalRequirements) * 100)
              : 0;
            setProgress({ assessedCount, completionRate });
          }
        }
      } catch (error) {
        console.error('Failed to load progress:', error);
      }
    };

    loadProgress();

    // Listen for progress updates
    const handleProgressUpdate = (event: CustomEvent) => {
      if (event.detail?.frameworkId === frameworkId) {
        setProgress({
          assessedCount: event.detail.assessedCount || 0,
          completionRate: event.detail.completionRate || 0
        });
      }
    };

    window.addEventListener('assessment-progress-update', handleProgressUpdate as EventListener);
    return () => {
      window.removeEventListener('assessment-progress-update', handleProgressUpdate as EventListener);
    };
  }, [frameworkId, totalRequirements]);

  return (
    <div className="ml-auto flex items-center gap-3">
      <LanguageSwitcher variant="minimal" />
      <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-white border border-slate-200">
        <span className="text-slate-500 whitespace-nowrap">{t.framework.completionRate}</span>
        <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-600 rounded-full transition-all duration-300"
            style={{ width: `${progress.completionRate}%` }}
          />
        </div>
        <span className="font-medium text-slate-800">{progress.completionRate}%</span>
        <span className="text-xs text-slate-400">
          ({progress.assessedCount}/{totalRequirements})
        </span>
      </div>
      <Link
        href={`/frameworks/${frameworkId}/report`}
        className="px-3 py-1.5 text-sm bg-cyan-700 text-white rounded-lg hover:bg-cyan-800"
      >
        {t.nav.assessmentReport}
      </Link>
    </div>
  );
}
