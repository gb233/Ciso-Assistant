'use client';

import type { Requirement } from '@/lib/data-loader';
import RequirementCard from './RequirementCard';
import { useAssessment } from '@/hooks/useAssessment';
import { useLanguage } from './LanguageProvider';
import { normalizeRequirementForView, type FrameworkPresentationProfile } from '@/lib/framework-presentation';
import type { AssessmentData, AssessmentStatus } from '@/lib/assessment-model';

interface RequirementWithContext extends Requirement {
  categoryName: string;
  subcategoryName: string;
}

interface RequirementSection {
  key: string;
  title?: string;
  requirements: RequirementWithContext[];
}

interface RequirementListFrameworkInfo {
  id: string;
  name: string;
  fullName?: string;
  version: string;
  type?: string;
  domain?: string;
  presentationMode?: string;
}

interface RequirementListProps {
  requirements: RequirementWithContext[];
  frameworkId: string;
  frameworkInfo?: RequirementListFrameworkInfo;
  enableAssessment?: boolean;
  presentationProfile?: FrameworkPresentationProfile;
  totalRequirements?: number;
  onProgressChange?: (progress: {
    assessedCount: number;
    totalRequirements: number;
    completionRate: number;
    assessmentStatusDistribution: Record<AssessmentStatus, number>;
    averageScore: number;
    assessmentBand: string;
  }) => void;
}

export default function RequirementList({
  requirements,
  frameworkId,
  frameworkInfo,
  enableAssessment = false,
  presentationProfile,
  totalRequirements,
  onProgressChange
}: RequirementListProps) {
  const { language } = useLanguage();
  const { getAssessment, updateAssessment, getProgress } = useAssessment(frameworkId);
  const normalizedRequirements = requirements.map((requirement) => ({
    ...normalizeRequirementForView(requirement),
    categoryName: requirement.categoryName,
    subcategoryName: requirement.subcategoryName,
  }));

  const handleAssessmentChange = (reqId: string, data: Omit<AssessmentData, 'updatedAt'>) => {
    if (!enableAssessment) return;
    updateAssessment(reqId, data);

    // Calculate and dispatch progress update
    const progressBase = totalRequirements ?? normalizedRequirements.length;
    const progress = getProgress(progressBase);

    // Dispatch custom event for FrameworkHeader
    window.dispatchEvent(new CustomEvent('assessment-progress-update', {
      detail: {
        frameworkId,
        ...progress
      }
    }));

    // Notify parent of progress change
    if (onProgressChange) {
      onProgressChange(progress);
    }
  };

  if (normalizedRequirements.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center h-64 text-slate-500">
          <p>{language === 'zh' ? '没有找到匹配的要求' : 'No matching requirements found'}</p>
        </div>
      </div>
    );
  }

  const sections: RequirementSection[] =
    presentationProfile?.listLayout === 'grouped-by-subcategory'
      ? Object.entries(
          normalizedRequirements.reduce<Record<string, RequirementWithContext[]>>((acc, requirement) => {
            const key = requirement.subcategoryName || (language === 'zh' ? '未分类' : 'Uncategorized');
            if (!acc[key]) acc[key] = [];
            acc[key].push(requirement);
            return acc;
          }, {})
        ).map(([subcategoryName, subRequirements]) => ({
          key: subcategoryName,
          title: subcategoryName,
          requirements: subRequirements,
        }))
      : [
          {
            key: 'all',
            requirements: normalizedRequirements,
          },
        ];

  return (
    <div className="flex-1 overflow-y-auto">
      {sections.map((section) => (
        <section key={section.key} className="border-b border-slate-200">
          {section.title && (
            <header className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200 px-4 py-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800 truncate">{section.title}</h2>
                <span className="text-xs text-slate-500">{section.requirements.length}</span>
              </div>
            </header>
          )}
          {section.requirements.map((requirement) => (
            <RequirementCard
              key={requirement.id}
              requirement={requirement}
              frameworkInfo={
                frameworkInfo || {
                  id: frameworkId,
                  name: frameworkId,
                  version: '',
                }
              }
              assessment={enableAssessment ? getAssessment(requirement.id) : undefined}
              onAssessmentChange={enableAssessment ? handleAssessmentChange : undefined}
              enableAssessment={enableAssessment}
              detailHref={`/frameworks/${frameworkId}/requirements/${requirement.id}`}
              presentationProfile={presentationProfile}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
