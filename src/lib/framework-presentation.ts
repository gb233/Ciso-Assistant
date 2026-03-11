import type { Framework, Requirement } from './data-loader';
import displayProfileConfig from '@/config/framework-display-profiles.json';

export type FrameworkPresentationMode = 'default' | 'sammy' | 'regulation';
export type RequirementListLayout = 'flat' | 'grouped-by-subcategory';
export type RequirementSidePanel = 'control-context' | 'rubric-scale' | 'clause-context';

export interface RequirementBadge {
  zh: string;
  en: string;
  className: string;
}

export interface FrameworkPresentationProfile {
  mode: FrameworkPresentationMode;
  label: string;
  listLayout: RequirementListLayout;
  descriptionStyle: 'brief' | 'detail' | 'article';
  listSummaryLimit: number;
  detailPreviewLimit: number | null;
  sidePanel: RequirementSidePanel;
  requirementBadge?: RequirementBadge;
}

interface FrameworkDisplayProfileConfig {
  schemaVersion: number;
  defaultModeByType: Record<string, FrameworkPresentationMode>;
  frameworkModes: Record<string, FrameworkPresentationMode>;
  validation?: {
    sammy?: {
      requireRubrics?: boolean;
      fallbackMode?: FrameworkPresentationMode;
    };
    regulation?: {
      minSourceRefCoverage?: number;
      minObligationCoverage?: number;
      fallbackMode?: FrameworkPresentationMode;
    };
  };
}

const DISPLAY_PROFILE_CONFIG = displayProfileConfig as FrameworkDisplayProfileConfig;

export const PRESENTATION_PROFILES: Record<FrameworkPresentationMode, FrameworkPresentationProfile> = {
  default: {
    mode: 'default',
    label: 'Control Leaf View',
    listLayout: 'flat',
    descriptionStyle: 'detail',
    listSummaryLimit: 300,
    detailPreviewLimit: 420,
    sidePanel: 'control-context',
    requirementBadge: {
      zh: '控制项',
      en: 'Control',
      className: 'bg-slate-50 text-slate-700 border-slate-200',
    },
  },
  sammy: {
    mode: 'sammy',
    label: 'Maturity Practice View',
    listLayout: 'grouped-by-subcategory',
    descriptionStyle: 'brief',
    listSummaryLimit: 180,
    detailPreviewLimit: 320,
    sidePanel: 'rubric-scale',
    requirementBadge: {
      zh: '成熟度实践',
      en: 'Maturity Practice',
      className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    },
  },
  regulation: {
    mode: 'regulation',
    label: 'Regulatory Obligation View',
    listLayout: 'flat',
    descriptionStyle: 'article',
    listSummaryLimit: 520,
    detailPreviewLimit: null,
    sidePanel: 'clause-context',
    requirementBadge: {
      zh: '法规条款',
      en: 'Regulatory Clause',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  },
};

interface FrameworkDisplayMetrics {
  controlCount: number;
  rubricCount: number;
  sourceRefCoverage: number;
  obligationCoverage: number;
}

export interface FrameworkRequirementSummary {
  controlCount: number;
  rubricCount: number;
  totalCount: number;
}

export function getFrameworkRequirementSummary(framework: Framework): FrameworkRequirementSummary {
  let controlCount = 0;
  let rubricCount = 0;

  for (const category of framework.categories || []) {
    for (const subcategory of category.subcategories || []) {
      for (const requirement of subcategory.requirements || []) {
        if (requirement.questionType === 'rubric') {
          rubricCount += 1;
          continue;
        }
        controlCount += 1;
      }

      rubricCount += (subcategory.rubrics || []).length;
    }
  }

  return {
    controlCount,
    rubricCount,
    totalCount: controlCount + rubricCount,
  };
}

function collectFrameworkDisplayMetrics(framework: Framework): FrameworkDisplayMetrics {
  const summary = getFrameworkRequirementSummary(framework);
  let sourceRefCount = 0;
  let obligationCount = 0;

  for (const category of framework.categories || []) {
    for (const subcategory of category.subcategories || []) {
      for (const requirement of subcategory.requirements || []) {
        if (requirement.questionType === 'rubric') continue;
        if (String(requirement.sourceRef || '').trim()) sourceRefCount += 1;
        if (String(requirement.obligationStrength || '').trim()) obligationCount += 1;
      }
    }
  }

  return {
    controlCount: summary.controlCount,
    rubricCount: summary.rubricCount,
    sourceRefCoverage: summary.controlCount > 0 ? sourceRefCount / summary.controlCount : 0,
    obligationCoverage: summary.controlCount > 0 ? obligationCount / summary.controlCount : 0,
  };
}

function resolveConfiguredMode(framework: Framework): FrameworkPresentationMode | null {
  const frameworkMode = DISPLAY_PROFILE_CONFIG.frameworkModes?.[framework.id];
  if (frameworkMode) return frameworkMode;

  const frameworkType = String(framework.type || '').trim().toLowerCase();
  const typeMode = frameworkType
    ? DISPLAY_PROFILE_CONFIG.defaultModeByType?.[frameworkType]
    : null;
  if (typeMode) return typeMode;

  return null;
}

function applyModeValidation(
  mode: FrameworkPresentationMode,
  metrics: FrameworkDisplayMetrics
): { mode: FrameworkPresentationMode; reason?: string } {
  if (mode === 'sammy') {
    const sammyRules = DISPLAY_PROFILE_CONFIG.validation?.sammy;
    const fallback = sammyRules?.fallbackMode || 'default';
    if (sammyRules?.requireRubrics && metrics.rubricCount <= 0) {
      return {
        mode: fallback,
        reason: `sammy mode requires rubrics, but rubricCount=${metrics.rubricCount}`,
      };
    }
  }

  if (mode === 'regulation') {
    const regulationRules = DISPLAY_PROFILE_CONFIG.validation?.regulation;
    const fallback = regulationRules?.fallbackMode || 'default';
    const minSourceRefCoverage = regulationRules?.minSourceRefCoverage ?? 0;
    const minObligationCoverage = regulationRules?.minObligationCoverage ?? 0;
    if (metrics.sourceRefCoverage < minSourceRefCoverage || metrics.obligationCoverage < minObligationCoverage) {
      return {
        mode: fallback,
        reason:
          `regulation mode requires sourceRef>=${minSourceRefCoverage} and obligation>=${minObligationCoverage}, ` +
          `but got sourceRef=${metrics.sourceRefCoverage.toFixed(2)}, obligation=${metrics.obligationCoverage.toFixed(2)}`,
      };
    }
  }

  return { mode };
}

function resolvePresentationMode(framework: Framework): FrameworkPresentationMode {
  const frameworkType = String(framework.type || '').trim().toLowerCase();
  const configuredMode = resolveConfiguredMode(framework);

  const totalRubrics = framework.stats?.totalRubrics ?? 0;
  const hasRubrics = totalRubrics > 0;
  const sourceType = String(framework?.source?.type || '').trim().toLowerCase();
  const isRegulationFramework =
    framework.type === 'regulation' ||
    framework.type === 'compliance' ||
    framework.id.startsWith('cn-') ||
    framework.id.startsWith('eu-');
  const fallbackMode: FrameworkPresentationMode = isRegulationFramework
    ? 'regulation'
    : (hasRubrics || sourceType === 'sammy-browse-snapshot' ? 'sammy' : 'default');
  const requestedMode = configuredMode || fallbackMode;

  const metrics = collectFrameworkDisplayMetrics(framework);
  const validated = applyModeValidation(requestedMode, metrics);
  if (validated.mode !== requestedMode && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[presentation] Auto-downgrade ${framework.id}: ${requestedMode} -> ${validated.mode}. ${validated.reason || ''}`
    );
  }
  if (validated.mode !== requestedMode) return validated.mode;

  if (process.env.NODE_ENV !== 'production' && frameworkType) {
    // New/unknown framework types should be reviewed before finalizing the display mode.
    const hasTypeMapping = Boolean(DISPLAY_PROFILE_CONFIG.defaultModeByType?.[frameworkType]);
    if (!hasTypeMapping) {
      console.warn(
        `[presentation] Unmapped framework type "${frameworkType}" for ${framework.id}; fallback to ${validated.mode}.`
      );
    }
  }

  return validated.mode;
}

export function resolveFrameworkPresentationProfile(framework: Framework): FrameworkPresentationProfile {
  const mode = resolvePresentationMode(framework);
  return PRESENTATION_PROFILES[mode];
}

function compactWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function cleanRequirementName(raw: string): string {
  return compactWhitespace(
    String(raw || '')
      .replace(/\s*标签\s*\d+\s*$/gi, '')
      .replace(/\s*Tag\s*\d+\s*$/gi, '')
  );
}

export function cleanRequirementDescription(raw: string): string {
  const text = String(raw || '');
  const withoutAssessmentTail = text
    .replace(/\n?\s*评估\s*\n?\s*评估:\s*0\s*1\s*2\s*3\s*$/gi, '')
    .replace(/\n?\s*Assessment\s*\n?\s*Assessment:\s*0\s*1\s*2\s*3\s*$/gi, '');

  return compactWhitespace(withoutAssessmentTail);
}

export function normalizeRequirementForView(requirement: Requirement): Requirement {
  return {
    ...requirement,
    name: cleanRequirementName(requirement.name || ''),
    description: cleanRequirementDescription(requirement.description || '')
  };
}
