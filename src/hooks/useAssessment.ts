'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ASSESSMENT_STORAGE_KEY,
  getAssessmentBandFromScore,
  getAssessmentScore,
  isRequirementAssessed,
  normalizeAssessmentData,
  type AssessmentData,
  type AssessmentStatus,
} from '@/lib/assessment-model';

export interface FrameworkAssessment {
  frameworkId: string;
  assessments: Record<string, AssessmentData>;
  lastUpdated: string;
}

export function useAssessment(frameworkId: string) {
  const [assessments, setAssessments] = useState<Record<string, AssessmentData>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load assessments from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ASSESSMENT_STORAGE_KEY);
      if (stored) {
        const allAssessments: Record<string, FrameworkAssessment> = JSON.parse(stored);
        const frameworkData = allAssessments[frameworkId];
        if (frameworkData?.assessments) {
          let hasMigration = false;
          const normalizedAssessments: Record<string, AssessmentData> = {};

          Object.entries(frameworkData.assessments).forEach(([reqId, data]) => {
            const normalized = normalizeAssessmentData(data);
            normalizedAssessments[reqId] = normalized;

            // If shape was legacy or invalid, normalized result differs in structure.
            if (
              !data ||
              typeof data !== 'object' ||
              !('assessmentStatus' in data)
            ) {
              hasMigration = true;
            }
          });

          setAssessments(normalizedAssessments);

          if (hasMigration) {
            allAssessments[frameworkId] = {
              ...frameworkData,
              assessments: normalizedAssessments,
              lastUpdated: new Date().toISOString(),
            };
            localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(allAssessments));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load assessments:', error);
    }
    setIsLoaded(true);
  }, [frameworkId]);

  // Save assessments to localStorage
  const saveAssessments = useCallback((newAssessments: Record<string, AssessmentData>) => {
    try {
      const stored = localStorage.getItem(ASSESSMENT_STORAGE_KEY);
      const allAssessments: Record<string, FrameworkAssessment> = stored ? JSON.parse(stored) : {};

      allAssessments[frameworkId] = {
        frameworkId,
        assessments: newAssessments,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(allAssessments));
    } catch (error) {
      console.error('Failed to save assessments:', error);
    }
  }, [frameworkId]);

  // Update a single assessment
  const updateAssessment = useCallback((reqId: string, data: Omit<AssessmentData, 'updatedAt'>) => {
    setAssessments(prev => {
      const newAssessments = {
        ...prev
      };

      const normalized = normalizeAssessmentData({ ...data, updatedAt: new Date().toISOString() });
      newAssessments[reqId] = normalized;

      saveAssessments(newAssessments);
      return newAssessments;
    });
  }, [saveAssessments]);

  // Get assessment for a requirement
  const getAssessment = useCallback((reqId: string): AssessmentData | undefined => {
    return assessments[reqId];
  }, [assessments]);

  // Calculate progress statistics
  const getProgress = useCallback((totalRequirements: number) => {
    const assessedEntries = Object.values(assessments).filter(isRequirementAssessed);
    const assessedCount = assessedEntries.length;
    const completionRate = totalRequirements > 0 ? (assessedCount / totalRequirements) * 100 : 0;

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

    assessedEntries.forEach((assessment) => {
      assessmentStatusDistribution[assessment.assessmentStatus] += 1;
      const score = getAssessmentScore(assessment.assessmentStatus);
      if (score !== null) {
        totalScore += score;
        scoredCount += 1;
      }
    });
    assessmentStatusDistribution.UNASSESSED = Math.max(totalRequirements - assessedCount, 0);

    const averageScore = scoredCount > 0 ? (totalScore / scoredCount) : 0;
    const assessmentBand = getAssessmentBandFromScore(averageScore);

    return {
      assessedCount,
      totalRequirements,
      completionRate: Math.round(completionRate),
      assessmentStatusDistribution,
      averageScore: Math.round(averageScore * 10) / 10,
      assessmentBand
    };
  }, [assessments]);

  // Clear all assessments for this framework
  const clearAssessments = useCallback(() => {
    setAssessments({});
    try {
      const stored = localStorage.getItem(ASSESSMENT_STORAGE_KEY);
      if (stored) {
        const allAssessments: Record<string, FrameworkAssessment> = JSON.parse(stored);
        delete allAssessments[frameworkId];
        localStorage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(allAssessments));
      }
    } catch (error) {
      console.error('Failed to clear assessments:', error);
    }
  }, [frameworkId]);

  // Export assessments as JSON
  const exportAssessments = useCallback(() => {
    return {
      frameworkId,
      assessments,
      exportedAt: new Date().toISOString()
    };
  }, [frameworkId, assessments]);

  return {
    assessments,
    isLoaded,
    updateAssessment,
    getAssessment,
    getProgress,
    clearAssessments,
    exportAssessments
  };
}
