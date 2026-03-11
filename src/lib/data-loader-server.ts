/**
 * 服务器端数据加载器
 * 用于构建时加载框架数据
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Framework, FrameworkMeta, Requirement } from './data-loader';
import type { Language } from './i18n';

const RUBRIC_NAME_PATTERNS = [
  /^层级不适用/i,
  /^Tier Not Applicable/i,
  /^CMMI 成熟度等级/i,
  /^CMMI Maturity Level/i,
  /^要求\s*覆盖/i,
  /^Requirement\s*Covered/i,
  /^未实现\s+已实现$/i,
  /^未实现\s+已完全实现$/i,
  /^未实现\s+完全实现$/i,
  /^Not implemented\s+Implemented$/i,
  /^Not implemented\s+Fully implemented$/i,
  /^政策定义\s+不适用/i,
  /^Policy defined\s+Not applicable/i,
  /^实施\s+不适用/i,
  /^Implementation\s+Not applicable/i,
  /^实施的控制\s+不适用/i,
  /^Control implemented\s+Not applicable/i,
  /^覆盖范围\s*-\s*无/i,
  /^Coverage\s*-\s*None/i,
  /^文档成熟度\s+不适用/i,
  /^Documentation Maturity\s+Not applicable/i
] as const;

interface OfficialBaselineEntry {
  expectedRequirements?: number;
  expectedControls?: number;
  expectedRubrics?: number;
  coverageStatus?: string;
  coverageNote?: string;
  sourceUrl?: string;
  sourceVersion?: string;
}

let officialBaselineMapCache: Record<string, OfficialBaselineEntry> | null = null;

const RUBRIC_DESCRIPTION_PATTERNS = [
  /评估\s*[:：]?\s*0\s*1\s*2\s*3/i,
  /Assessment\s*[:：]?\s*0\s*1\s*2\s*3/i,
  /评估\s*[:：]?\s*0123/i,
  /Assessment\s*[:：]?\s*0123/i,
  /未实现\s+已实现/i,
  /未实现\s+已完全实现/i,
  /未实现\s+完全实现/i,
  /Not implemented\s+Implemented/i,
  /Not implemented\s+Fully implemented/i
] as const;

async function readJsonSafe(path: string): Promise<any | null> {
  try {
    const fileContent = await readFile(path, 'utf-8');
    return JSON.parse(fileContent);
  } catch {
    return null;
  }
}

async function getOfficialBaselineMap(): Promise<Record<string, OfficialBaselineEntry>> {
  if (officialBaselineMapCache) {
    return officialBaselineMapCache;
  }

  const baselinePath = join(process.cwd(), 'scripts/frameworks/official-baselines.json');
  const baselinePayload = await readJsonSafe(baselinePath);
  officialBaselineMapCache = (baselinePayload?.frameworks || {}) as Record<string, OfficialBaselineEntry>;
  return officialBaselineMapCache;
}

function withCoverageMeta(
  framework: Framework,
  baseline: OfficialBaselineEntry | undefined
): Framework {
  const statusRaw = String(baseline?.coverageStatus || 'full').trim().toLowerCase();
  const status = statusRaw === 'partial' ? 'partial' : (baseline ? 'full' : 'unknown');
  const toNumber = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
    return value;
  };
  const sourceUrl = String(baseline?.sourceUrl || '').trim();
  const sourceVersion = String(baseline?.sourceVersion || '').trim();
  const note = String(baseline?.coverageNote || '').trim();

  return {
    ...framework,
    coverage: {
      status,
      expectedRequirements: toNumber(baseline?.expectedRequirements),
      expectedControls: toNumber(baseline?.expectedControls),
      expectedRubrics: toNumber(baseline?.expectedRubrics),
      note: note || undefined,
      sourceUrl: sourceUrl || undefined,
      sourceVersion: sourceVersion || undefined,
    },
  };
}

function countFrameworkRequirements(framework: Framework | null | undefined): number {
  if (!framework) return 0;
  let requirements = 0;
  for (const category of framework.categories || []) {
    for (const subcategory of category.subcategories || []) {
      for (const requirement of subcategory.requirements || []) {
        const questionType = requirement?.questionType;
        if (questionType === 'rubric') continue;
        if (!questionType && looksLikeRubricRequirement(requirement)) continue;
        requirements += 1;
      }
    }
  }
  return requirements;
}

function looksLikeRubricRequirement(requirement: Requirement): boolean {
  const name = String(requirement?.name || '').trim();
  const description = String(requirement?.description || '').trim();

  if (requirement?.parentControlCode) return true;
  if (/^标签\s*\d+$/i.test(name) || /^tag\s*\d+$/i.test(name)) return true;
  if (RUBRIC_NAME_PATTERNS.some((pattern) => pattern.test(name))) return true;
  if (RUBRIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description))) return true;

  return false;
}

function normalizeRequirement(
  requirement: Requirement,
  fallbackType: 'control' | 'rubric'
): Requirement {
  const normalizedType =
    requirement.questionType === 'control' || requirement.questionType === 'rubric'
      ? requirement.questionType
      : looksLikeRubricRequirement(requirement)
        ? 'rubric'
        : fallbackType;

  return {
    ...requirement,
    questionType: normalizedType,
  };
}

function normalizeFrameworkData(input: Framework): Framework {
  const framework = structuredClone(input);

  framework.categories = (framework.categories || []).map((category) => ({
    ...category,
    subcategories: (category.subcategories || []).map((subcategory) => {
      const normalizedRequirements = (subcategory.requirements || []).map((requirement) =>
        normalizeRequirement(requirement, 'control')
      );
      const controls = normalizedRequirements.filter((requirement) => requirement.questionType === 'control');
      const misplacedRubrics = normalizedRequirements.filter((requirement) => requirement.questionType === 'rubric');
      const existingRubrics = (subcategory.rubrics || []).map((requirement) =>
        normalizeRequirement(requirement, 'rubric')
      );

      return {
        ...subcategory,
        requirements: controls,
        rubrics: [...existingRubrics, ...misplacedRubrics],
      };
    }),
  }));

  return framework;
}

function mergeIndexRequirements(preferred: FrameworkMeta[], fallback: FrameworkMeta[]): FrameworkMeta[] {
  const fallbackMap = new Map(fallback.map(item => [item.id, item.requirements]));
  return preferred.map(item => {
    const fallbackReq = fallbackMap.get(item.id);
    if (typeof fallbackReq !== 'number') return item;
    return {
      ...item,
      requirements: Math.max(item.requirements || 0, fallbackReq),
    };
  });
}

/**
 * 获取所有框架元数据列表（服务器端）
 */
export async function getFrameworksServer(lang: Language = 'zh'): Promise<FrameworkMeta[]> {
  try {
    const dataDir = join(process.cwd(), 'public/data/frameworks');
    const primaryPath = join(dataDir, lang === 'en' ? 'index-en.json' : 'index.json');
    const primaryData = await readJsonSafe(primaryPath);
    const primaryFrameworks: FrameworkMeta[] = primaryData?.frameworks || [];

    if (lang === 'zh') {
      const fallbackData = await readJsonSafe(join(dataDir, 'index-en.json'));
      const fallbackFrameworks: FrameworkMeta[] = fallbackData?.frameworks || [];
      return mergeIndexRequirements(primaryFrameworks, fallbackFrameworks);
    }

    if (primaryFrameworks.length > 0) {
      return primaryFrameworks;
    }

    const fallbackData = await readJsonSafe(join(dataDir, 'index.json'));
    return fallbackData?.frameworks || [];
  } catch (error) {
    console.error('Failed to load frameworks:', error);
    return [];
  }
}

/**
 * 获取单个框架详情（服务器端）
 */
export async function getFrameworkServer(id: string, lang: Language = 'zh'): Promise<Framework | null> {
  try {
    const dataDir = join(process.cwd(), 'public/data/frameworks');
    const zhPath = join(dataDir, `${id}.json`);
    const enPath = join(dataDir, `${id}-en.json`);
    const baselineMap = await getOfficialBaselineMap();
    const baseline = baselineMap[id];

    if (lang === 'zh') {
      const [zhData, enData] = await Promise.all([
        readJsonSafe(zhPath) as Promise<Framework | null>,
        readJsonSafe(enPath) as Promise<Framework | null>,
      ]);
      const zhCount = countFrameworkRequirements(zhData);
      const enCount = countFrameworkRequirements(enData);
      const selected = zhData && zhCount >= enCount ? zhData : enData || zhData;
      if (!selected) return null;
      return withCoverageMeta(normalizeFrameworkData(selected), baseline);
    }

    const enData = (await readJsonSafe(enPath)) as Framework | null;
    if (enData) return withCoverageMeta(normalizeFrameworkData(enData), baseline);
    const zhData = (await readJsonSafe(zhPath)) as Framework | null;
    if (!zhData) return null;
    return withCoverageMeta(normalizeFrameworkData(zhData), baseline);
  } catch (error) {
    console.error(`Failed to load framework ${id}:`, error);
    return null;
  }
}
