#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'public/data/frameworks');
const BASELINE_PATH = join(ROOT, 'scripts/frameworks/official-baselines.json');
const REPORT_DIR = join(ROOT, 'docs/framework-checkpoints');
const SOURCE_PLACEHOLDER = 'TO_BE_CONFIRMED_OFFICIAL_SOURCE';
const CJK_RE = /[\u3400-\u9FFF]/;

const args = process.argv.slice(2);
const frameworkOnly = getArgValue('--framework');
const continueOnError = args.includes('--continue-on-error');

function getArgValue(name) {
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }

  const index = args.findIndex(arg => arg === name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }

  return null;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonSafe(path) {
  try {
    return {
      ok: true,
      data: await readJson(path),
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function isReadable(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function createStage(name) {
  return {
    name,
    pass: true,
    skipped: false,
    skipReason: null,
    checks: [],
    errors: [],
    warnings: []
  };
}

function createSkippedStage(name, reason) {
  return {
    name,
    pass: null,
    skipped: true,
    skipReason: reason,
    checks: [],
    errors: [],
    warnings: []
  };
}

function addCheck(stage, input) {
  const {
    label,
    pass,
    details = null,
    expected = null,
    actual = null,
    severity = 'error'
  } = input;

  const check = {
    label,
    pass,
    severity,
    details,
    expected,
    actual
  };

  stage.checks.push(check);

  if (pass) {
    return;
  }

  const detailText = details || `${label}${expected !== null || actual !== null ? ` (expected=${expected}, actual=${actual})` : ''}`;
  if (severity === 'warning') {
    stage.warnings.push(detailText);
    return;
  }

  stage.errors.push(detailText);
  stage.pass = false;
}

function countFramework(framework) {
  const categories = framework.categories || [];
  let subcategories = 0;
  let requirements = 0;
  let categoryDeclaredSum = 0;
  let categoryDeclaredMismatchCount = 0;
  const categoryMismatchDetails = [];

  const reqIdSet = new Set();
  const reqCodeSet = new Set();
  const duplicateRequirementIds = new Set();
  const duplicateRequirementCodes = new Set();

  for (const category of categories) {
    const subcats = category.subcategories || [];
    subcategories += subcats.length;

    let categoryActual = 0;
    for (const sub of subcats) {
      const reqs = sub.requirements || [];
      requirements += reqs.length;
      categoryActual += reqs.length;

      for (const req of reqs) {
        if (req?.id) {
          if (reqIdSet.has(req.id)) duplicateRequirementIds.add(req.id);
          reqIdSet.add(req.id);
        }
        if (req?.code) {
          if (reqCodeSet.has(req.code)) duplicateRequirementCodes.add(req.code);
          reqCodeSet.add(req.code);
        }
      }
    }

    if (typeof category.requirements === 'number') {
      categoryDeclaredSum += category.requirements;
      if (category.requirements !== categoryActual) {
        categoryDeclaredMismatchCount += 1;
        categoryMismatchDetails.push({
          categoryId: category.id,
          categoryCode: category.code,
          declared: category.requirements,
          actual: categoryActual
        });
      }
    }
  }

  return {
    categories: categories.length,
    subcategories,
    requirements,
    categoryDeclaredSum,
    categoryDeclaredMismatchCount,
    categoryMismatchDetails,
    duplicateRequirementIds: [...duplicateRequirementIds],
    duplicateRequirementCodes: [...duplicateRequirementCodes]
  };
}

function countCjkStrings(node) {
  let cjk = 0;
  const walk = value => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
      return;
    }
    if (typeof value === 'string' && CJK_RE.test(value)) {
      cjk += 1;
    }
  };
  walk(node);
  return cjk;
}

function findFrameworkMeta(indexData, id) {
  return (indexData.frameworks || []).find(item => item.id === id) || null;
}

function getBaselinesMap(rawBaselineData) {
  if (rawBaselineData?.frameworks && typeof rawBaselineData.frameworks === 'object') {
    return rawBaselineData.frameworks;
  }
  return rawBaselineData || {};
}

function resolveCanonicalLanguage({ baseline, enMeta, zhMeta }) {
  const explicit = baseline?.canonicalLanguage;
  if (explicit === 'en' || explicit === 'zh') {
    return explicit;
  }

  const region = enMeta?.region || zhMeta?.region || 'global';
  return region === 'cn' ? 'zh' : 'en';
}

function getFrameworkPath(id, language) {
  return join(DATA_DIR, language === 'en' ? `${id}-en.json` : `${id}.json`);
}

function normalizeSourceLabel(source) {
  if (typeof source !== 'string') return null;
  const trimmed = source.trim();
  if (!trimmed) return null;
  if (trimmed === SOURCE_PLACEHOLDER) return null;
  return trimmed;
}

function normalizeSourceUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string') return null;
  const trimmed = sourceUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.toString();
  } catch {
    return null;
  }
}

function summarizeFailure(stages) {
  for (const [name, stage] of Object.entries(stages)) {
    if (stage.pass === false) {
      return name;
    }
  }
  return null;
}

async function runPreflight({ id, enMeta, zhMeta, baseline }) {
  const stage = createStage('preflight');

  addCheck(stage, {
    label: 'index-en metadata exists',
    pass: Boolean(enMeta),
    details: enMeta ? null : `Missing framework ${id} in index-en.json`
  });

  addCheck(stage, {
    label: 'index-zh metadata exists',
    pass: Boolean(zhMeta),
    details: zhMeta ? null : `Missing framework ${id} in index.json`
  });

  addCheck(stage, {
    label: 'official baseline exists',
    pass: Boolean(baseline),
    details: baseline ? null : `Missing baseline config for framework ${id}`
  });

  if (!baseline) {
    return {
      stage,
      canonicalLanguage: null,
      translationLanguage: null,
      canonicalPath: null,
      translationPath: null,
      source: null,
      sourceUrl: null
    };
  }

  const canonicalLanguage = resolveCanonicalLanguage({ baseline, enMeta, zhMeta });
  const translationLanguage = canonicalLanguage === 'en' ? 'zh' : 'en';

  addCheck(stage, {
    label: 'canonical language resolvable',
    pass: canonicalLanguage === 'en' || canonicalLanguage === 'zh',
    details: `Resolved canonical language: ${String(canonicalLanguage)}`
  });

  addCheck(stage, {
    label: 'expectedRequirements present',
    pass: typeof baseline.expectedRequirements === 'number' && baseline.expectedRequirements > 0,
    details:
      typeof baseline.expectedRequirements === 'number'
        ? null
        : 'baseline.expectedRequirements must be a positive number'
  });

  if (baseline.expectedCategories !== undefined) {
    addCheck(stage, {
      label: 'expectedCategories is numeric',
      pass: typeof baseline.expectedCategories === 'number' && baseline.expectedCategories >= 0,
      details: `baseline.expectedCategories=${String(baseline.expectedCategories)}`
    });
  }

  if (baseline.expectedSubcategories !== undefined) {
    addCheck(stage, {
      label: 'expectedSubcategories is numeric',
      pass: typeof baseline.expectedSubcategories === 'number' && baseline.expectedSubcategories >= 0,
      details: `baseline.expectedSubcategories=${String(baseline.expectedSubcategories)}`
    });
  }

  const canonicalPath = canonicalLanguage ? getFrameworkPath(id, canonicalLanguage) : null;
  const translationPath = translationLanguage ? getFrameworkPath(id, translationLanguage) : null;

  const source = normalizeSourceLabel(baseline.source);
  const sourceUrl = normalizeSourceUrl(baseline.sourceUrl);

  addCheck(stage, {
    label: 'source label configured',
    pass: Boolean(source),
    severity: 'warning',
    details: source ? null : 'baseline.source should identify official source document'
  });

  addCheck(stage, {
    label: 'source URL configured and valid',
    pass: Boolean(sourceUrl),
    severity: 'warning',
    details: sourceUrl ? null : 'baseline.sourceUrl should be a valid official URL for pull pre-check'
  });

  return {
    stage,
    canonicalLanguage,
    translationLanguage,
    canonicalPath,
    translationPath,
    source,
    sourceUrl
  };
}

async function runPullStage({ id, canonicalLanguage, canonicalPath }) {
  const stage = createStage('pull');

  if (!canonicalPath || !canonicalLanguage) {
    addCheck(stage, {
      label: 'canonical source path resolvable',
      pass: false,
      details: 'Cannot resolve canonical source path'
    });
    return {
      stage,
      data: null,
      stats: null
    };
  }

  const readable = await isReadable(canonicalPath);
  addCheck(stage, {
    label: 'canonical source file is readable',
    pass: readable,
    details: readable ? null : `File not readable: ${canonicalPath.replace(`${ROOT}/`, '')}`
  });

  if (!readable) {
    return {
      stage,
      data: null,
      stats: null
    };
  }

  const loaded = await readJsonSafe(canonicalPath);
  addCheck(stage, {
    label: 'canonical source JSON parse',
    pass: loaded.ok,
    details: loaded.ok ? null : loaded.error
  });

  if (!loaded.ok || !loaded.data) {
    return {
      stage,
      data: null,
      stats: null
    };
  }

  const data = loaded.data;
  const stats = countFramework(data);

  addCheck(stage, {
    label: 'canonical file id matches framework id',
    pass: data.id === id,
    expected: id,
    actual: data.id ?? null
  });

  addCheck(stage, {
    label: 'canonical file language matches expected language',
    pass: data.language === canonicalLanguage,
    expected: canonicalLanguage,
    actual: data.language ?? null
  });

  addCheck(stage, {
    label: 'canonical hierarchy has requirements',
    pass: stats.requirements > 0,
    details: `requirements=${stats.requirements}`
  });

  stage.metrics = {
    categories: stats.categories,
    subcategories: stats.subcategories,
    requirements: stats.requirements
  };

  return {
    stage,
    data,
    stats
  };
}

function runPostPullValidation({
  baseline,
  canonicalStats,
  canonicalData,
  canonicalIndexMeta
}) {
  const stage = createStage('postPullValidation');

  if (!baseline || !canonicalStats || !canonicalData) {
    addCheck(stage, {
      label: 'post-pull prerequisites available',
      pass: false,
      details: 'Baseline/canonical stats/canonical data is missing'
    });
    return stage;
  }

  addCheck(stage, {
    label: 'actual requirements matches baseline expectedRequirements',
    pass: baseline.expectedRequirements === canonicalStats.requirements,
    expected: baseline.expectedRequirements,
    actual: canonicalStats.requirements
  });

  if (typeof baseline.expectedCategories === 'number') {
    addCheck(stage, {
      label: 'actual categories matches baseline expectedCategories',
      pass: baseline.expectedCategories === canonicalStats.categories,
      expected: baseline.expectedCategories,
      actual: canonicalStats.categories
    });
  }

  if (typeof baseline.expectedSubcategories === 'number') {
    addCheck(stage, {
      label: 'actual subcategories matches baseline expectedSubcategories',
      pass: baseline.expectedSubcategories === canonicalStats.subcategories,
      expected: baseline.expectedSubcategories,
      actual: canonicalStats.subcategories
    });
  }

  addCheck(stage, {
    label: 'canonical file stats.totalRequirements matches actual requirements',
    pass: canonicalData?.stats?.totalRequirements === canonicalStats.requirements,
    expected: canonicalData?.stats?.totalRequirements ?? null,
    actual: canonicalStats.requirements
  });

  addCheck(stage, {
    label: 'canonical index requirements matches actual requirements',
    pass: (canonicalIndexMeta?.requirements ?? null) === canonicalStats.requirements,
    expected: canonicalIndexMeta?.requirements ?? null,
    actual: canonicalStats.requirements
  });

  addCheck(stage, {
    label: 'category.requirements declarations are consistent',
    pass: canonicalStats.categoryDeclaredMismatchCount === 0,
    details: `mismatchCount=${canonicalStats.categoryDeclaredMismatchCount}`
  });

  addCheck(stage, {
    label: 'requirement ids are unique',
    pass: canonicalStats.duplicateRequirementIds.length === 0,
    details:
      canonicalStats.duplicateRequirementIds.length === 0
        ? null
        : `duplicates=${canonicalStats.duplicateRequirementIds.length}`
  });

  addCheck(stage, {
    label: 'requirement codes are unique',
    pass: canonicalStats.duplicateRequirementCodes.length === 0,
    details:
      canonicalStats.duplicateRequirementCodes.length === 0
        ? null
        : `duplicates=${canonicalStats.duplicateRequirementCodes.length}`
  });

  stage.metrics = {
    categories: canonicalStats.categories,
    subcategories: canonicalStats.subcategories,
    requirements: canonicalStats.requirements,
    categoryDeclaredMismatchCount: canonicalStats.categoryDeclaredMismatchCount,
    duplicateRequirementIds: canonicalStats.duplicateRequirementIds.length,
    duplicateRequirementCodes: canonicalStats.duplicateRequirementCodes.length
  };

  if (canonicalStats.categoryMismatchDetails.length > 0) {
    stage.categoryMismatchDetails = canonicalStats.categoryMismatchDetails;
  }

  return stage;
}

async function runTranslationReadiness({
  id,
  translationLanguage,
  translationPath,
  canonicalStats,
  translationIndexMeta
}) {
  const stage = createStage('translationReadiness');

  if (!translationPath || !translationLanguage) {
    addCheck(stage, {
      label: 'translation path resolvable',
      pass: false,
      details: 'Cannot resolve translation path'
    });
    return stage;
  }

  const readable = await isReadable(translationPath);
  addCheck(stage, {
    label: 'translation file is readable',
    pass: readable,
    details: readable ? null : `File not readable: ${translationPath.replace(`${ROOT}/`, '')}`
  });

  if (!readable) {
    return stage;
  }

  const loaded = await readJsonSafe(translationPath);
  addCheck(stage, {
    label: 'translation JSON parse',
    pass: loaded.ok,
    details: loaded.ok ? null : loaded.error
  });

  if (!loaded.ok || !loaded.data) {
    return stage;
  }

  const translationData = loaded.data;
  const translationStats = countFramework(translationData);
  const cjkStrings = countCjkStrings(translationData);

  addCheck(stage, {
    label: 'translation file language matches expected language',
    pass: translationData.language === translationLanguage,
    expected: translationLanguage,
    actual: translationData.language ?? null
  });

  addCheck(stage, {
    label: 'translation hierarchy requirement count matches canonical source',
    pass: translationStats.requirements === canonicalStats.requirements,
    expected: canonicalStats.requirements,
    actual: translationStats.requirements
  });

  addCheck(stage, {
    label: 'translation hierarchy category count matches canonical source',
    pass: translationStats.categories === canonicalStats.categories,
    expected: canonicalStats.categories,
    actual: translationStats.categories
  });

  addCheck(stage, {
    label: 'translation hierarchy subcategory count matches canonical source',
    pass: translationStats.subcategories === canonicalStats.subcategories,
    expected: canonicalStats.subcategories,
    actual: translationStats.subcategories
  });

  addCheck(stage, {
    label: 'translation file stats.totalRequirements matches actual requirements',
    pass: translationData?.stats?.totalRequirements === translationStats.requirements,
    expected: translationData?.stats?.totalRequirements ?? null,
    actual: translationStats.requirements
  });

  addCheck(stage, {
    label: 'translation index requirements matches translation actual requirements',
    pass: (translationIndexMeta?.requirements ?? null) === translationStats.requirements,
    expected: translationIndexMeta?.requirements ?? null,
    actual: translationStats.requirements
  });

  addCheck(stage, {
    label: 'translation category.requirements declarations are consistent',
    pass: translationStats.categoryDeclaredMismatchCount === 0,
    details: `mismatchCount=${translationStats.categoryDeclaredMismatchCount}`
  });

  addCheck(stage, {
    label: 'translation requirement ids are unique',
    pass: translationStats.duplicateRequirementIds.length === 0,
    details:
      translationStats.duplicateRequirementIds.length === 0
        ? null
        : `duplicates=${translationStats.duplicateRequirementIds.length}`
  });

  addCheck(stage, {
    label: 'translation requirement codes are unique',
    pass: translationStats.duplicateRequirementCodes.length === 0,
    details:
      translationStats.duplicateRequirementCodes.length === 0
        ? null
        : `duplicates=${translationStats.duplicateRequirementCodes.length}`
  });

  if (translationLanguage === 'en') {
    addCheck(stage, {
      label: 'translation english file should not contain Chinese strings',
      pass: cjkStrings === 0,
      details: `cjkStrings=${cjkStrings}`
    });
  }

  if (translationLanguage === 'zh') {
    addCheck(stage, {
      label: 'translation chinese file should contain Chinese strings',
      pass: cjkStrings > 0,
      details: `cjkStrings=${cjkStrings}`
    });
  }

  stage.metrics = {
    categories: translationStats.categories,
    subcategories: translationStats.subcategories,
    requirements: translationStats.requirements,
    cjkStrings,
    categoryDeclaredMismatchCount: translationStats.categoryDeclaredMismatchCount,
    duplicateRequirementIds: translationStats.duplicateRequirementIds.length,
    duplicateRequirementCodes: translationStats.duplicateRequirementCodes.length
  };

  if (translationStats.categoryMismatchDetails.length > 0) {
    stage.categoryMismatchDetails = translationStats.categoryMismatchDetails;
  }

  return stage;
}

async function verifyFramework(id, indexZh, indexEn, baselines) {
  const zhMeta = findFrameworkMeta(indexZh, id);
  const enMeta = findFrameworkMeta(indexEn, id);
  const baseline = baselines[id] || null;

  const preflightResult = await runPreflight({ id, enMeta, zhMeta, baseline });

  let pullResult;
  let postPullStage;
  let translationStage;

  if (!preflightResult.stage.pass) {
    pullResult = {
      stage: createSkippedStage('pull', 'Skipped because preflight failed'),
      data: null,
      stats: null
    };
    postPullStage = createSkippedStage(
      'postPullValidation',
      'Skipped because preflight failed'
    );
    translationStage = createSkippedStage(
      'translationReadiness',
      'Skipped because preflight failed'
    );
  } else {
    pullResult = await runPullStage({
      id,
      canonicalLanguage: preflightResult.canonicalLanguage,
      canonicalPath: preflightResult.canonicalPath
    });

    if (!pullResult.stage.pass) {
      postPullStage = createSkippedStage(
        'postPullValidation',
        'Skipped because pull stage failed'
      );
      translationStage = createSkippedStage(
        'translationReadiness',
        'Skipped because pull stage failed'
      );
    } else {
      const canonicalIndexMeta =
        preflightResult.canonicalLanguage === 'en' ? enMeta : zhMeta;
      const translationIndexMeta =
        preflightResult.translationLanguage === 'en' ? enMeta : zhMeta;

      postPullStage = runPostPullValidation({
        baseline,
        canonicalStats: pullResult.stats,
        canonicalData: pullResult.data,
        canonicalIndexMeta
      });

      if (!postPullStage.pass) {
        translationStage = createSkippedStage(
          'translationReadiness',
          'Skipped because postPullValidation failed'
        );
      } else {
        translationStage = await runTranslationReadiness({
          id,
          translationLanguage: preflightResult.translationLanguage,
          translationPath: preflightResult.translationPath,
          canonicalStats: pullResult.stats,
          translationIndexMeta
        });
      }
    }
  }

  const stages = {
    preflight: preflightResult.stage,
    pull: pullResult.stage,
    postPullValidation: postPullStage,
    translationReadiness: translationStage
  };

  const failedStage = summarizeFailure(stages);
  const pass = failedStage === null;

  const errorCount = Object.values(stages)
    .map(stage => stage.errors.length)
    .reduce((sum, n) => sum + n, 0);

  const warningCount = Object.values(stages)
    .map(stage => stage.warnings.length)
    .reduce((sum, n) => sum + n, 0);

  return {
    frameworkId: id,
    frameworkName: enMeta?.name || zhMeta?.name || pullResult?.data?.name || id,
    checkedAt: new Date().toISOString(),
    baseline: baseline
      ? {
          canonicalLanguage: baseline.canonicalLanguage ?? null,
          source: baseline.source ?? null,
          sourceUrl: baseline.sourceUrl ?? null,
          sourceVersion: baseline.sourceVersion ?? null,
          expectedRequirements: baseline.expectedRequirements ?? null,
          expectedCategories: baseline.expectedCategories ?? null,
          expectedSubcategories: baseline.expectedSubcategories ?? null
        }
      : null,
    canonical: {
      language: preflightResult.canonicalLanguage,
      path: preflightResult.canonicalPath
        ? preflightResult.canonicalPath.replace(`${ROOT}/`, '')
        : null
    },
    translation: {
      language: preflightResult.translationLanguage,
      path: preflightResult.translationPath
        ? preflightResult.translationPath.replace(`${ROOT}/`, '')
        : null
    },
    stages,
    summary: {
      pass,
      failedStage,
      errorCount,
      warningCount
    }
  };
}

function printResultLine(result) {
  if (result.summary.pass) {
    const metrics = result.stages.postPullValidation.metrics || result.stages.pull.metrics;
    const statsSuffix = metrics
      ? ` categories=${metrics.categories} subcategories=${metrics.subcategories} requirements=${metrics.requirements}`
      : '';
    console.log(`[PASS] ${result.frameworkId}${statsSuffix}`);
    return;
  }

  console.log(
    `[FAIL] ${result.frameworkId} stage=${result.summary.failedStage} errors=${result.summary.errorCount} warnings=${result.summary.warningCount}`
  );

  for (const [name, stage] of Object.entries(result.stages)) {
    if (stage.skipped) {
      console.log(`  - [${name}] skipped: ${stage.skipReason}`);
      continue;
    }

    for (const err of stage.errors) {
      console.log(`  - [${name}] ${err}`);
    }

    for (const warning of stage.warnings) {
      console.log(`  - [${name}] warning: ${warning}`);
    }
  }
}

async function main() {
  const indexZh = await readJson(join(DATA_DIR, 'index.json'));
  const indexEn = await readJson(join(DATA_DIR, 'index-en.json'));
  const rawBaselineData = await readJson(BASELINE_PATH);
  const baselines = getBaselinesMap(rawBaselineData);

  const allIds = (indexEn.frameworks || []).map(item => item.id);
  const frameworkIds = frameworkOnly ? allIds.filter(id => id === frameworkOnly) : allIds;

  if (frameworkIds.length === 0) {
    throw new Error(frameworkOnly ? `Framework not found in index-en: ${frameworkOnly}` : 'No frameworks to verify');
  }

  await mkdir(REPORT_DIR, { recursive: true });

  let checked = 0;
  let passed = 0;

  for (const id of frameworkIds) {
    const result = await verifyFramework(id, indexZh, indexEn, baselines);
    checked += 1;
    if (result.summary.pass) passed += 1;

    const reportPath = join(REPORT_DIR, `${id}.json`);
    await writeJson(reportPath, result);

    printResultLine(result);
    console.log(`  report: ${reportPath.replace(`${ROOT}/`, '')}`);

    if (!result.summary.pass && !continueOnError) {
      console.log('');
      console.log(`Gate stopped at framework "${id}". Fix this framework before pulling the next one.`);
      process.exit(1);
    }
  }

  console.log('');
  console.log(`Gate completed. checked=${checked}, passed=${passed}, failed=${checked - passed}`);
  if (checked !== passed) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
