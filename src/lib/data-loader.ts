/**
 * 前端数据加载器
 * 用于加载框架数据和构建搜索索引
 */

import { getStoredLanguage, normalizeLanguage } from './i18n';

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

// 框架元数据类型
export interface FrameworkMeta {
  id: string;
  name: string;
  fullName: string;
  version: string;
  type: string;
  domain: string;
  description: string;
  requirements: number;
  language: string;
  region: string;
}

// 要求类型
export interface Requirement {
  id: string;
  code: string;
  name: string;
  description: string;
  contentLanguage?: string;
  questionType?: 'control' | 'rubric';
  parentControlCode?: string;
  level?: string;
  cwe?: string;
  nist?: string;
  verification?: string;
  sourceRef?: string;
  obligationStrength?: 'MUST' | 'SHOULD' | 'MAY' | string;
  applicability?: {
    subject?: string;
    scenario?: string;
    dataType?: string;
    region?: string;
    trigger?: string;
    [key: string]: string | undefined;
  };
}

// 子分类类型
export interface Subcategory {
  id: string;
  code: string;
  name: string;
  description: string;
  requirements: Requirement[];
  rubrics?: Requirement[];
}

// 分类类型
export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  requirements?: number;
  subcategories: Subcategory[];
}

// 成熟度级别定义
export interface MaturityLevel {
  level: number;
  name: string;
  description: string;
  characteristics: string[];
}

// 评估问题
export interface AssessmentQuestion {
  id: string;
  category: string;
  subcategory: string;
  question: string;
  description?: string;
  level: number;
  requirementId?: string;
  parentControlCode?: string;
  source?: 'rubric' | 'generated';
}

// 完整框架类型
export interface Framework {
  id: string;
  name: string;
  fullName: string;
  version: string;
  type: string;
  domain: string;
  description: string;
  website?: string;
  organization?: string;
  releaseDate?: string;
  lastUpdated?: string;
  language: string;
  source?: {
    type?: string;
    url?: string;
    slug?: string;
    snapshotDate?: string;
  };
  coverage?: {
    status?: 'full' | 'partial' | 'unknown';
    expectedRequirements?: number;
    expectedControls?: number;
    expectedRubrics?: number;
    note?: string;
    sourceUrl?: string;
    sourceVersion?: string;
  };
  stats?: {
    totalRequirements: number;
    totalRubrics?: number;
    byTag?: Record<string, number>;
  };
  categories: Category[];
  // 扩展字段
  maturityLevels?: MaturityLevel[];
  assessmentQuestions?: AssessmentQuestion[];
}

// 缓存
let frameworksCache: Partial<Record<'zh' | 'en', FrameworkMeta[]>> = {};
let frameworkCache: Map<string, Framework> = new Map();

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

function looksLikeRubricRequirement(requirement: Requirement): boolean {
  const name = String(requirement?.name || '').trim();
  const description = String(requirement?.description || '').trim();

  if (requirement?.parentControlCode) return true;
  if (/^标签\s*\d+$/i.test(name) || /^tag\s*\d+$/i.test(name)) return true;
  if (RUBRIC_NAME_PATTERNS.some((pattern) => pattern.test(name))) return true;
  if (RUBRIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description))) return true;

  return false;
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

async function fetchJson(path: string): Promise<any | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// 搜索项类型
export interface SearchItem {
  id: string;
  code: string;
  name: string;
  description: string;
  frameworkId: string;
  frameworkName: string;
  categoryName: string;
  subcategoryName: string;
  level?: string;
  path: string;
}

/**
 * 获取所有框架元数据列表
 */
export async function getFrameworks(lang?: string): Promise<FrameworkMeta[]> {
  const resolvedLang = normalizeLanguage(lang || getStoredLanguage());
  if (frameworksCache[resolvedLang]) {
    return frameworksCache[resolvedLang] || [];
  }

  try {
    const primaryFile = resolvedLang === 'en' ? 'index-en.json' : 'index.json';
    const primaryData = await fetchJson(`/data/frameworks/${primaryFile}`);
    const primaryFrameworks: FrameworkMeta[] = primaryData?.frameworks || [];

    if (resolvedLang === 'zh') {
      const fallbackData = await fetchJson('/data/frameworks/index-en.json');
      const fallbackFrameworks: FrameworkMeta[] = fallbackData?.frameworks || [];
      const merged = mergeIndexRequirements(primaryFrameworks, fallbackFrameworks);
      frameworksCache[resolvedLang] = merged;
      return merged;
    }

    if (primaryFrameworks.length > 0) {
      frameworksCache[resolvedLang] = primaryFrameworks;
      return primaryFrameworks;
    }

    const fallbackData = await fetchJson('/data/frameworks/index.json');
    const fallbackFrameworks: FrameworkMeta[] = fallbackData?.frameworks || [];
    frameworksCache[resolvedLang] = fallbackFrameworks;
    return fallbackFrameworks;
  } catch (error) {
    console.error('Failed to load frameworks:', error);
    return [];
  }
}

/**
 * 获取单个框架详情
 */
export async function getFramework(id: string, lang?: string): Promise<Framework | null> {
  const resolvedLang = normalizeLanguage(lang || getStoredLanguage());
  const cacheKey = `${id}-${resolvedLang}`;
  if (frameworkCache.has(cacheKey)) {
    return frameworkCache.get(cacheKey) || null;
  }

  try {
    const zhPath = `/data/frameworks/${id}.json`;
    const enPath = `/data/frameworks/${id}-en.json`;

    if (resolvedLang === 'zh') {
      const [zhData, enData] = await Promise.all([
        fetchJson(zhPath) as Promise<Framework | null>,
        fetchJson(enPath) as Promise<Framework | null>,
      ]);

      const zhCount = countFrameworkRequirements(zhData);
      const enCount = countFrameworkRequirements(enData);
      const selected = zhData && zhCount >= enCount ? zhData : enData || zhData;

      if (selected) {
        const normalized = normalizeFrameworkData(selected);
        frameworkCache.set(cacheKey, normalized);
        return normalized;
      }
      return null;
    }

    const enData = (await fetchJson(enPath)) as Framework | null;
    if (enData) {
      const normalized = normalizeFrameworkData(enData);
      frameworkCache.set(cacheKey, normalized);
      return normalized;
    }

    const zhData = (await fetchJson(zhPath)) as Framework | null;
    if (zhData) {
      const normalized = normalizeFrameworkData(zhData);
      frameworkCache.set(cacheKey, normalized);
      return normalized;
    }
    return null;
  } catch (error) {
    console.error(`Failed to load framework ${id}:`, error);
    return null;
  }
}

/**
 * 获取框架的所有要求（扁平化）
 */
export function getAllRequirements(framework: Framework): Requirement[] {
  const requirements: Requirement[] = [];

  framework.categories.forEach(category => {
    category.subcategories.forEach(subcategory => {
      subcategory.requirements.forEach(req => {
        requirements.push(req);
      });
    });
  });

  return requirements;
}

/**
 * 获取框架的所有评估量表问题（rubric）
 */
export function getAllRubrics(framework: Framework): Requirement[] {
  const rubrics: Requirement[] = [];

  framework.categories.forEach(category => {
    category.subcategories.forEach(subcategory => {
      (subcategory.rubrics || []).forEach(rubric => {
        rubrics.push(rubric);
      });
    });
  });

  return rubrics;
}

/**
 * 从 rubric 字段生成评估问题
 */
export function buildAssessmentQuestionsFromRubrics(framework: Framework): AssessmentQuestion[] {
  const questions: AssessmentQuestion[] = [];
  let sequence = 1;

  framework.categories.forEach((category) => {
    category.subcategories.forEach((subcategory) => {
      (subcategory.rubrics || []).forEach((rubric) => {
        questions.push({
          id: rubric.id || `rubric-${sequence}`,
          category: category.name,
          subcategory: subcategory.name,
          question: rubric.name,
          description: rubric.description,
          level: 1,
          requirementId: rubric.id,
          parentControlCode: rubric.parentControlCode,
          source: 'rubric',
        });
        sequence += 1;
      });
    });
  });

  return questions;
}

/**
 * 根据ID查找要求
 */
export function findRequirementById(
  framework: Framework,
  requirementId: string
): { requirement: Requirement; category: Category; subcategory: Subcategory } | null {
  for (const category of framework.categories) {
    for (const subcategory of category.subcategories) {
      const requirement = subcategory.requirements.find(r => r.id === requirementId);
      if (requirement) {
        return { requirement, category, subcategory };
      }
    }
  }
  return null;
}

/**
 * 根据代码查找要求
 */
export function findRequirementByCode(
  framework: Framework,
  code: string
): { requirement: Requirement; category: Category; subcategory: Subcategory } | null {
  for (const category of framework.categories) {
    for (const subcategory of category.subcategories) {
      const requirement = subcategory.requirements.find(r => r.code === code);
      if (requirement) {
        return { requirement, category, subcategory };
      }
    }
  }
  return null;
}

/**
 * 构建面包屑路径
 */
export function buildBreadcrumbPath(
  framework: Framework,
  category?: Category,
  subcategory?: Subcategory,
  requirement?: Requirement
): { label: string; href: string }[] {
  const path: { label: string; href: string }[] = [
    { label: framework.name, href: `/frameworks/${framework.id}` }
  ];

  if (category) {
    path.push({
      label: category.name,
      href: `/frameworks/${framework.id}/categories/${category.id}`
    });
  }

  if (subcategory) {
    path.push({
      label: subcategory.name,
      href: `/frameworks/${framework.id}/subcategories/${subcategory.id}`
    });
  }

  if (requirement) {
    path.push({
      label: requirement.code,
      href: `/frameworks/${framework.id}/requirements/${requirement.id}`
    });
  }

  return path;
}

/**
 * 获取框架统计信息
 */
export function getFrameworkStats(framework: Framework): {
  total: number;
  byTag: Record<string, number>;
  byCategory: Record<string, number>;
} {
  const stats = {
    total: 0,
    byTag: {} as Record<string, number>,
    byCategory: {} as Record<string, number>
  };

  framework.categories.forEach(category => {
    let categoryCount = 0;
    category.subcategories.forEach(subcategory => {
      subcategory.requirements.forEach(req => {
        stats.total++;
        categoryCount++;
        if (req.level) {
          stats.byTag[req.level] = (stats.byTag[req.level] || 0) + 1;
        }
      });
    });
    stats.byCategory[category.name] = categoryCount;
  });

  return stats;
}

/**
 * 清除缓存
 */
export function clearCache(): void {
  frameworksCache = {};
  frameworkCache.clear();
}
