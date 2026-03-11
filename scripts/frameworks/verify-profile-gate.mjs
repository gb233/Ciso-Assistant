#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "fs/promises";
import { constants } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "public/data/frameworks");
const INDEX_ZH_PATH = join(DATA_DIR, "index.json");
const INDEX_EN_PATH = join(DATA_DIR, "index-en.json");
const BASELINE_PATH = join(ROOT, "scripts/frameworks/official-baselines.json");
const PROFILE_RULES_PATH = join(ROOT, "scripts/frameworks/gate-profiles.json");
const FRAMEWORK_PROFILES_PATH = join(ROOT, "scripts/frameworks/framework-profiles.json");
const REQUIREMENT_V2_SCHEMA_PATH = join(ROOT, "docs/schemas/requirement-v2.schema.json");
const V2_SPEC_DIR = join(ROOT, "docs/specs/framework-v2");
const REPORT_DIR = join(ROOT, "docs/framework-checkpoints/profile-gate");
const SUMMARY_REPORT_PATH = join(ROOT, "docs/framework-checkpoints/profile-gate-summary.json");

const args = process.argv.slice(2);
const frameworkOnly = getArgValue("--framework");
const mode = (getArgValue("--mode") || "report").toLowerCase();
const continueOnError = args.includes("--continue-on-error");
const tierOverride = getArgValue("--tier");

const tierOrder = {
  bronze: 1,
  silver: 2,
  gold: 3
};

function getArgValue(name) {
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.findIndex(arg => arg === name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return null;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
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
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function addCheck(report, input) {
  const {
    label,
    pass,
    severity = "error",
    details = null,
    expected = null,
    actual = null
  } = input;

  const check = {
    label,
    pass,
    severity,
    details,
    expected,
    actual
  };
  report.checks.push(check);

  if (pass) return;

  const detailText =
    details || `${label}${expected !== null || actual !== null ? ` (expected=${expected}, actual=${actual})` : ""}`;
  if (severity === "warning") {
    report.warnings.push(detailText);
  } else {
    report.errors.push(detailText);
  }
}

function findFrameworkMeta(indexData, id) {
  return (indexData.frameworks || []).find(item => item.id === id) || null;
}

function getBaselinesMap(rawBaselineData) {
  if (rawBaselineData?.frameworks && typeof rawBaselineData.frameworks === "object") {
    return rawBaselineData.frameworks;
  }
  return rawBaselineData || {};
}

function resolveCanonicalLanguage({ baseline, zhMeta, enMeta }) {
  const explicit = baseline?.canonicalLanguage;
  if (explicit === "en" || explicit === "zh") return explicit;

  const region = zhMeta?.region || enMeta?.region || "global";
  return region === "cn" ? "zh" : "en";
}

function getFrameworkPath(id, language) {
  return join(DATA_DIR, language === "en" ? `${id}-en.json` : `${id}.json`);
}

function normalizeTier(input) {
  if (!input) return null;
  const lower = input.toLowerCase();
  return tierOrder[lower] ? lower : null;
}

function hasTierAtLeast(tier, minimum) {
  return tierOrder[tier] >= tierOrder[minimum];
}

function countFramework(framework) {
  const categories = framework.categories || [];
  let requirements = 0;
  let subcategories = 0;
  const reqIdSet = new Set();
  const reqCodeSet = new Set();
  const duplicateIds = new Set();
  const duplicateCodes = new Set();

  for (const category of categories) {
    const subcats = category.subcategories || [];
    subcategories += subcats.length;
    for (const sub of subcats) {
      const reqs = sub.requirements || [];
      requirements += reqs.length;
      for (const req of reqs) {
        if (req?.id) {
          if (reqIdSet.has(req.id)) duplicateIds.add(req.id);
          reqIdSet.add(req.id);
        }
        if (req?.code) {
          if (reqCodeSet.has(req.code)) duplicateCodes.add(req.code);
          reqCodeSet.add(req.code);
        }
      }
    }
  }

  return {
    categories: categories.length,
    subcategories,
    requirements,
    duplicateIds: [...duplicateIds],
    duplicateCodes: [...duplicateCodes]
  };
}

async function loadV2Records(frameworkId) {
  const candidates = [
    join(V2_SPEC_DIR, `${frameworkId}.requirements-v2.json`),
    join(V2_SPEC_DIR, `${frameworkId}.requirements-v2.sample.json`)
  ];

  for (const path of candidates) {
    if (!(await isReadable(path))) continue;
    const loaded = await readJsonSafe(path);
    if (!loaded.ok || !loaded.data) {
      return {
        found: true,
        path,
        ok: false,
        records: [],
        error: loaded.error
      };
    }

    let records = [];
    if (Array.isArray(loaded.data)) {
      records = loaded.data;
    } else if (Array.isArray(loaded.data.requirements)) {
      records = loaded.data.requirements;
    }

    return {
      found: true,
      path,
      ok: true,
      records,
      error: null
    };
  }

  return {
    found: false,
    path: null,
    ok: true,
    records: [],
    error: null
  };
}

function validateV2RecordShape(record) {
  const requiredKeys = ["id", "code", "name", "description", "instrumentKinds", "semantics", "source", "profile", "audit"];
  const missing = requiredKeys.filter(key => !(key in record));
  if (missing.length > 0) {
    return {
      pass: false,
      details: `Missing keys: ${missing.join(", ")}`
    };
  }
  return { pass: true, details: null };
}

async function verifyFramework(input) {
  const {
    frameworkId,
    indexZh,
    indexEn,
    baselines,
    profileRules,
    frameworkProfiles
  } = input;

  const report = {
    frameworkId,
    checkedAt: new Date().toISOString(),
    mode,
    checks: [],
    errors: [],
    warnings: [],
    summary: {
      pass: true,
      profileId: null,
      enforcedTier: null
    }
  };

  const zhMeta = findFrameworkMeta(indexZh, frameworkId);
  const enMeta = findFrameworkMeta(indexEn, frameworkId);
  const profileEntry = frameworkProfiles?.profiles?.[frameworkId] || null;
  const baseline = baselines[frameworkId] || null;

  addCheck(report, {
    label: "index-zh metadata exists",
    pass: Boolean(zhMeta),
    details: zhMeta ? null : `Missing ${frameworkId} in index.json`
  });

  addCheck(report, {
    label: "index-en metadata exists",
    pass: Boolean(enMeta),
    details: enMeta ? null : `Missing ${frameworkId} in index-en.json`
  });

  addCheck(report, {
    label: "framework profile assignment exists",
    pass: Boolean(profileEntry),
    details: profileEntry ? null : `Missing profile assignment for ${frameworkId}`
  });

  if (!profileEntry) {
    report.summary.pass = report.errors.length === 0;
    return report;
  }

  const profileId = profileEntry.profileId;
  const profileRule = profileRules?.profiles?.[profileId] || null;
  const frameworkType = profileEntry.frameworkType || zhMeta?.type || enMeta?.type || "standard";
  const enforcedTier = normalizeTier(tierOverride) || normalizeTier(profileEntry.enforcedTier) || "bronze";
  report.summary.profileId = profileId;
  report.summary.enforcedTier = enforcedTier;

  addCheck(report, {
    label: "profile rule exists",
    pass: Boolean(profileRule),
    details: profileRule ? null : `Profile rule ${profileId} not found in gate-profiles.json`
  });

  addCheck(report, {
    label: "framework type matches profile allowed types",
    pass: profileRule ? (profileRule.appliesToFrameworkTypes || []).includes(frameworkType) : false,
    expected: profileRule ? profileRule.appliesToFrameworkTypes.join(",") : null,
    actual: frameworkType
  });

  addCheck(report, {
    label: "official baseline exists",
    pass: Boolean(baseline),
    details: baseline ? null : `Missing baseline config for ${frameworkId}`
  });

  const canonicalLanguage = resolveCanonicalLanguage({ baseline, zhMeta, enMeta });
  const canonicalPath = getFrameworkPath(frameworkId, canonicalLanguage);
  const canonicalIndexMeta = canonicalLanguage === "zh" ? zhMeta : enMeta;

  const readable = await isReadable(canonicalPath);
  addCheck(report, {
    label: "canonical framework file is readable",
    pass: readable,
    details: readable ? canonicalPath.replace(`${ROOT}/`, "") : `File not readable: ${canonicalPath.replace(`${ROOT}/`, "")}`
  });

  if (readable) {
    const loaded = await readJsonSafe(canonicalPath);
    addCheck(report, {
      label: "canonical framework file JSON parse",
      pass: loaded.ok,
      details: loaded.ok ? null : loaded.error
    });

    if (loaded.ok && loaded.data) {
      const stats = countFramework(loaded.data);
      addCheck(report, {
        label: "canonical requirement ids are unique",
        pass: stats.duplicateIds.length === 0,
        details: stats.duplicateIds.length === 0 ? null : `duplicateIds=${stats.duplicateIds.length}`
      });
      addCheck(report, {
        label: "canonical requirement codes are unique",
        pass: stats.duplicateCodes.length === 0,
        details: stats.duplicateCodes.length === 0 ? null : `duplicateCodes=${stats.duplicateCodes.length}`
      });
      addCheck(report, {
        label: "index requirement count equals canonical requirement count",
        pass: (canonicalIndexMeta?.requirements ?? null) === stats.requirements,
        expected: canonicalIndexMeta?.requirements ?? null,
        actual: stats.requirements
      });
      report.metrics = stats;
    }
  }

  const hasSchema = await isReadable(REQUIREMENT_V2_SCHEMA_PATH);
  addCheck(report, {
    label: "requirement-v2 schema exists",
    pass: hasSchema,
    details: hasSchema ? REQUIREMENT_V2_SCHEMA_PATH.replace(`${ROOT}/`, "") : "docs/schemas/requirement-v2.schema.json not found"
  });

  if (hasTierAtLeast(enforcedTier, "silver")) {
    const v2 = await loadV2Records(frameworkId);
    addCheck(report, {
      label: "tier>=silver requires framework-level requirement-v2 spec file",
      pass: v2.found,
      details: v2.found ? v2.path.replace(`${ROOT}/`, "") : `Missing ${frameworkId}.requirements-v2(.sample).json in docs/specs/framework-v2`
    });

    if (v2.found) {
      addCheck(report, {
        label: "requirement-v2 spec JSON parse",
        pass: v2.ok,
        details: v2.ok ? null : v2.error
      });
      addCheck(report, {
        label: "requirement-v2 spec has at least one record",
        pass: v2.records.length > 0,
        actual: v2.records.length
      });
      if (v2.records.length > 0) {
        const shape = validateV2RecordShape(v2.records[0]);
        addCheck(report, {
          label: "first requirement-v2 record matches base shape",
          pass: shape.pass,
          details: shape.details
        });
      }
    }
  }

  if (hasTierAtLeast(enforcedTier, "gold")) {
    addCheck(report, {
      label: "tier>=gold requires semantic diff artifact",
      pass: false,
      severity: "warning",
      details: "semantic diff artifact check is not implemented yet; keep framework at silver/bronze until pipeline is ready"
    });
  }

  report.summary.pass = report.errors.length === 0;
  return report;
}

async function main() {
  const effectiveMode = mode === "enforce" ? "enforce" : "report";
  const indexZh = await readJson(INDEX_ZH_PATH);
  const indexEn = await readJson(INDEX_EN_PATH);
  const baselineRaw = await readJson(BASELINE_PATH);
  const profileRules = await readJson(PROFILE_RULES_PATH);
  const frameworkProfiles = await readJson(FRAMEWORK_PROFILES_PATH);
  const baselines = getBaselinesMap(baselineRaw);

  const allIds = Object.keys(frameworkProfiles?.profiles || {});
  const targetIds = frameworkOnly ? allIds.filter(id => id === frameworkOnly) : allIds;

  if (frameworkOnly && targetIds.length === 0) {
    throw new Error(`Framework not found in profile assignment: ${frameworkOnly}`);
  }

  await mkdir(REPORT_DIR, { recursive: true });
  const results = [];
  let failed = 0;

  for (const id of targetIds) {
    const report = await verifyFramework({
      frameworkId: id,
      indexZh,
      indexEn,
      baselines,
      profileRules,
      frameworkProfiles
    });
    results.push(report);

    const reportPath = join(REPORT_DIR, `${id}.json`);
    await writeJson(reportPath, report);

    const icon = report.summary.pass ? "PASS" : "FAIL";
    const message = `[${icon}] ${id} profile=${report.summary.profileId} tier=${report.summary.enforcedTier} errors=${report.errors.length} warnings=${report.warnings.length}`;
    console.log(message);
    if (!report.summary.pass) {
      failed += 1;
      if (effectiveMode === "enforce" && !continueOnError) break;
    }
  }

  const summary = {
    checkedAt: new Date().toISOString(),
    mode: effectiveMode,
    frameworkOnly: frameworkOnly || null,
    total: results.length,
    passed: results.filter(r => r.summary.pass).length,
    failed: results.filter(r => !r.summary.pass).length,
    reportDir: REPORT_DIR.replace(`${ROOT}/`, ""),
    results: results.map(item => ({
      frameworkId: item.frameworkId,
      pass: item.summary.pass,
      profileId: item.summary.profileId,
      tier: item.summary.enforcedTier,
      errors: item.errors.length,
      warnings: item.warnings.length
    }))
  };
  await writeJson(SUMMARY_REPORT_PATH, summary);

  console.log(`Summary: checked=${summary.total} passed=${summary.passed} failed=${summary.failed}`);
  console.log(`Summary report: ${SUMMARY_REPORT_PATH.replace(`${ROOT}/`, "")}`);

  if (effectiveMode === "enforce" && failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
