'use client';

import { useState } from 'react';
import type { Requirement } from '@/lib/data-loader';
import { useLanguage } from './LanguageProvider';
import { PRESENTATION_PROFILES, type FrameworkPresentationProfile } from '@/lib/framework-presentation';
import {
  DEFAULT_ASSESSMENT,
  type AssessmentData,
  type AssessmentStatus,
} from '@/lib/assessment-model';
import AIRequirementInterpreter from './AIRequirementInterpreter';

interface FrameworkInfo {
  id: string;
  name: string;
  fullName?: string;
  version: string;
  type?: string;
  domain?: string;
  presentationMode?: string;
}

interface RequirementCardProps {
  frameworkInfo: FrameworkInfo;
  requirement: Requirement & {
    categoryName?: string;
    subcategoryName?: string;
  };
  assessment?: AssessmentData;
  onAssessmentChange?: (reqId: string, data: Omit<AssessmentData, 'updatedAt'>) => void;
  enableAssessment?: boolean;
  detailHref?: string;
  presentationProfile?: FrameworkPresentationProfile;
}

const assessmentStatusTextColors: Record<AssessmentStatus, string> = {
  UNASSESSED: 'text-slate-500',
  NOT_APPLICABLE: 'text-slate-600',
  NOT_STARTED: 'text-red-600',
  IN_PROGRESS: 'text-amber-600',
  IMPLEMENTED: 'text-cyan-700',
  VERIFIED_EFFECTIVE: 'text-green-700',
};

export default function RequirementCard({
  frameworkInfo,
  requirement,
  assessment,
  onAssessmentChange,
  enableAssessment = true,
  detailHref,
  presentationProfile
}: RequirementCardProps) {
  const { language } = useLanguage();
  const isZh = language === 'zh';
  const profile = presentationProfile || PRESENTATION_PROFILES.default;

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

  const currentAssessment: Omit<AssessmentData, 'updatedAt'> = {
    assessmentStatus: assessment?.assessmentStatus || DEFAULT_ASSESSMENT.assessmentStatus,
    notes: assessment?.notes || '',
  };
  const [notes, setNotes] = useState(currentAssessment.notes);
  const [expandedDescription, setExpandedDescription] = useState(true);
  const assessmentStatus = currentAssessment.assessmentStatus;
  const notesFieldId = `assessment-notes-${requirement.id}`;
  const summaryLimit = profile.listSummaryLimit;
  const isRegulationMode = profile.mode === 'regulation';
  const descriptionText = String(requirement.description || '');
  const shouldTrimDescription = profile.descriptionStyle !== 'article';
  const isLongDescription = descriptionText.length > summaryLimit;
  const summary = shouldTrimDescription && isLongDescription
    ? `${descriptionText.slice(0, summaryLimit)}...`
    : descriptionText;
  const displayDescription = expandedDescription ? descriptionText : summary;
  const shouldKeepLineBreaks = profile.descriptionStyle === 'article';
  const badge = profile.requirementBadge;
  const sourceRef = String(requirement.sourceRef || '').trim();
  const obligationStrength = String(requirement.obligationStrength || '').trim().toUpperCase();
  const contentLanguage = String(requirement.contentLanguage || '').trim().toLowerCase();
  const preferredLanguage = isZh ? 'zh' : 'en';
  const showContentLanguageHint = Boolean(contentLanguage) && contentLanguage !== preferredLanguage;
  const localizedLanguageLabel = contentLanguage === 'zh'
    ? (isZh ? '中文' : 'Chinese')
    : contentLanguage === 'en'
      ? (isZh ? '英文' : 'English')
      : contentLanguage.toUpperCase();
  const applicability = requirement.applicability || {};
  const applicabilityParts = [
    applicability.subject,
    applicability.scenario,
    applicability.dataType,
    applicability.region,
    applicability.trigger
  ].filter((item): item is string => Boolean(item && String(item).trim()));

  const obligationClassName = obligationStrength === 'MUST'
    ? 'bg-red-50 text-red-700 border-red-200'
    : obligationStrength === 'SHOULD'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : obligationStrength === 'MAY'
        ? 'bg-slate-50 text-slate-700 border-slate-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';

  const updateAssessment = (patch: Partial<Omit<AssessmentData, 'updatedAt'>>) => {
    onAssessmentChange?.(requirement.id, {
      ...currentAssessment,
      notes,
      ...patch,
    });
  };

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    onAssessmentChange?.(requirement.id, { ...currentAssessment, notes: newNotes });
  };

  const handleApplyInterpretationToNotes = (interpretation: string) => {
    const merged = notes.trim() ? `${notes.trim()}\n\n${interpretation.trim()}` : interpretation.trim();
    handleNotesChange(merged);
  };

  return (
    <div className="border-b border-slate-200 p-4 hover:bg-cyan-50/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-slate-500 text-xs">{requirement.code}</span>
              <span className="font-semibold text-slate-900">{requirement.name}</span>
              {badge && (
                <span className={`px-2 py-0.5 text-xs rounded border ${badge.className}`}>
                  {isZh ? badge.zh : badge.en}
                </span>
              )}
            </div>
            {(requirement.categoryName || requirement.subcategoryName) && (
              <div className="mb-2 text-xs text-slate-500">
                {[requirement.categoryName, requirement.subcategoryName].filter(Boolean).join(' / ')}
              </div>
            )}
            <p className={`text-sm text-slate-600 leading-relaxed ${shouldKeepLineBreaks ? 'whitespace-pre-wrap' : ''}`}>
              {displayDescription}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {enableAssessment && (
              <AIRequirementInterpreter
                isZh={isZh}
                framework={frameworkInfo}
                requirement={{
                  id: requirement.id,
                  code: requirement.code,
                  name: requirement.name,
                  description: requirement.description,
                  categoryName: requirement.categoryName,
                  subcategoryName: requirement.subcategoryName,
                  sourceRef: requirement.sourceRef,
                  obligationStrength: requirement.obligationStrength,
                  verification: requirement.verification,
                  contentLanguage: requirement.contentLanguage,
                  applicability: requirement.applicability,
                }}
                assessment={assessment}
                onApplyToNotes={handleApplyInterpretationToNotes}
              />
            )}
            {enableAssessment && assessmentStatus !== 'UNASSESSED' ? (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${assessmentStatusTextColors[assessmentStatus]}`}>
                  {assessmentStatusLabels[assessmentStatus]}
                </span>
              </div>
            ) : enableAssessment ? (
              <span className="px-3 py-1 text-xs text-cyan-700 bg-cyan-50 rounded border border-cyan-200">
                {isZh ? '评估' : 'Assess'}
              </span>
            ) : null}
            {!isRegulationMode && (
              <div className="text-xs text-slate-400">
                {requirement.cwe && `CWE-${requirement.cwe}`}
                {requirement.cwe && requirement.nist && ' | '}
                {requirement.nist}
              </div>
            )}
          </div>
        </div>

        {isRegulationMode && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {showContentLanguageHint && (
                <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
                  {isZh ? '条文原文语言' : 'Clause language'}: {localizedLanguageLabel}
                </span>
              )}
              {sourceRef && (
                <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                  {isZh ? '来源' : 'Source'}: {sourceRef}
                </span>
              )}
              {obligationStrength && (
                <span className={`inline-flex items-center rounded border px-2 py-1 text-xs ${obligationClassName}`}>
                  {isZh ? '义务强度' : 'Obligation'}: {obligationStrength}
                </span>
              )}
              {applicabilityParts.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>

            {requirement.verification && (
              <div className="rounded-md border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs text-amber-800">
                <span className="font-semibold">{isZh ? '证据建议' : 'Evidence hint'}: </span>
                {requirement.verification}
              </div>
            )}
          </div>
        )}

        {shouldTrimDescription && isLongDescription && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpandedDescription((prev) => !prev)}
              className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              {expandedDescription
                ? (isZh ? '收起摘要' : 'Collapse')
                : (isZh ? '展开全文' : 'Expand full text')}
            </button>
          </div>
        )}

        {enableAssessment && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 min-w-[64px]">{isZh ? '评估状态' : 'Assessment status'}:</span>
            {(
              ['UNASSESSED', 'NOT_APPLICABLE', 'NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED_EFFECTIVE'] as AssessmentStatus[]
            ).map((status) => (
              <button
                key={status}
                onClick={() => updateAssessment({ assessmentStatus: status })}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  assessmentStatus === status
                    ? 'border-2 border-cyan-500 bg-cyan-50 text-cyan-700'
                    : 'border border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                {assessmentStatusLabels[status]}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500">{isZh ? '评估备注' : 'Assessment notes'}:</span>
            </div>
            <textarea
              id={notesFieldId}
              name={notesFieldId}
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={isZh ? '添加评估备注...' : 'Add assessment notes...'}
              className="w-full max-w-lg px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              rows={2}
            />
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
