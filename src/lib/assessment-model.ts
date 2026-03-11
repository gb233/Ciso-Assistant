export const ASSESSMENT_STORAGE_KEY = 'security-framework-assessments';

export type AssessmentStatus =
  | 'UNASSESSED'
  | 'NOT_APPLICABLE'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'VERIFIED_EFFECTIVE';

export interface AssessmentData {
  assessmentStatus: AssessmentStatus;
  notes: string;
  updatedAt: string;
}

interface LegacyAssessmentData {
  score: 0 | 1 | 2 | 3;
  notes?: string;
  updatedAt?: string;
}

interface PreviousAssessmentData {
  implementationStatus?: unknown;
  notes?: unknown;
  updatedAt?: unknown;
}

export const DEFAULT_ASSESSMENT: Omit<AssessmentData, 'updatedAt'> = {
  assessmentStatus: 'UNASSESSED',
  notes: '',
};

export const ASSESSMENT_STATUS_ORDER: AssessmentStatus[] = [
  'UNASSESSED',
  'NOT_APPLICABLE',
  'NOT_STARTED',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'VERIFIED_EFFECTIVE',
];

export function isLegacyAssessmentData(value: unknown): value is LegacyAssessmentData {
  if (!value || typeof value !== 'object') return false;
  const score = (value as { score?: unknown }).score;
  return score === 0 || score === 1 || score === 2 || score === 3;
}

function isAssessmentStatus(value: unknown): value is AssessmentStatus {
  return (
    value === 'UNASSESSED' ||
    value === 'NOT_APPLICABLE' ||
    value === 'NOT_STARTED' ||
    value === 'IN_PROGRESS' ||
    value === 'IMPLEMENTED' ||
    value === 'VERIFIED_EFFECTIVE'
  );
}

function isPreviousAssessmentData(value: unknown): value is PreviousAssessmentData {
  return Boolean(value && typeof value === 'object' && 'implementationStatus' in (value as object));
}

export function migrateLegacyAssessmentData(legacy: LegacyAssessmentData): AssessmentData {
  const now = new Date().toISOString();
  const statusFromLegacy: Record<LegacyAssessmentData['score'], AssessmentStatus> = {
    0: 'UNASSESSED',
    1: 'NOT_STARTED',
    2: 'IN_PROGRESS',
    3: 'IMPLEMENTED',
  };

  return {
    assessmentStatus: statusFromLegacy[legacy.score],
    notes: String(legacy.notes || ''),
    updatedAt: String(legacy.updatedAt || now),
  };
}

function migratePreviousAssessmentData(previous: PreviousAssessmentData): AssessmentData {
  const now = new Date().toISOString();
  const rawStatus = previous.implementationStatus;

  return {
    assessmentStatus: isAssessmentStatus(rawStatus) ? rawStatus : 'UNASSESSED',
    notes: typeof previous.notes === 'string' ? previous.notes : '',
    updatedAt: typeof previous.updatedAt === 'string' && previous.updatedAt ? previous.updatedAt : now,
  };
}

export function normalizeAssessmentData(value: unknown): AssessmentData {
  if (isLegacyAssessmentData(value)) {
    return migrateLegacyAssessmentData(value);
  }

  if (isPreviousAssessmentData(value)) {
    return migratePreviousAssessmentData(value);
  }

  const source = (value || {}) as Partial<AssessmentData>;
  const now = new Date().toISOString();
  return {
    assessmentStatus: isAssessmentStatus(source.assessmentStatus) ? source.assessmentStatus : 'UNASSESSED',
    notes: typeof source.notes === 'string' ? source.notes : '',
    updatedAt: typeof source.updatedAt === 'string' && source.updatedAt ? source.updatedAt : now,
  };
}

export function isRequirementAssessed(data: AssessmentData): boolean {
  return data.assessmentStatus !== 'UNASSESSED';
}

export function getAssessmentScore(status: AssessmentStatus): number | null {
  switch (status) {
    case 'NOT_STARTED':
      return 0;
    case 'IN_PROGRESS':
      return 1;
    case 'IMPLEMENTED':
      return 2;
    case 'VERIFIED_EFFECTIVE':
      return 3;
    default:
      return null;
  }
}

export function getAssessmentBandFromScore(score: number): 'initial' | 'developing' | 'managed' | 'optimized' {
  if (score < 1) return 'initial';
  if (score < 2) return 'developing';
  if (score < 3) return 'managed';
  return 'optimized';
}

