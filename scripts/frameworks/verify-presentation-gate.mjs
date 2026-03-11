#!/usr/bin/env node

import { promises as fs } from "fs";
import { dirname, join } from "path";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "public/data/frameworks");
const DISPLAY_PROFILE_CONFIG_PATH = join(ROOT, "src/config/framework-display-profiles.json");

const args = process.argv.slice(2);
const mode = (getArgValue("--mode") || "report").toLowerCase();
const frameworkOnly = getArgValue("--framework");
const outputPath = getArgValue("--output");

const VALID_MODES = new Set(["default", "sammy", "regulation"]);
const FAIL_ON_VIOLATION = mode === "ci" || mode === "strict";

function getArgValue(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.findIndex((arg) => arg === name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return null;
}

function isNonEmptyText(value) {
  return String(value || "").trim().length > 0;
}

function safeLower(value) {
  return String(value || "").trim().toLowerCase();
}

function safeMode(modeName, fallback = "default") {
  return VALID_MODES.has(modeName) ? modeName : fallback;
}

function resolveConfiguredMode(framework, config) {
  const frameworkMode = config.frameworkModes?.[framework.id];
  if (frameworkMode) return frameworkMode;

  const frameworkType = safeLower(framework.type);
  if (frameworkType && config.defaultModeByType?.[frameworkType]) {
    return config.defaultModeByType[frameworkType];
  }

  return null;
}

function collectFrameworkDisplayMetrics(framework) {
  let controlCount = 0;
  let rubricCount = 0;
  let sourceRefCount = 0;
  let obligationCount = 0;

  for (const category of framework.categories || []) {
    for (const subcategory of category.subcategories || []) {
      for (const requirement of subcategory.requirements || []) {
        const questionType = safeLower(requirement?.questionType);
        if (questionType === "rubric") {
          rubricCount += 1;
          continue;
        }

        controlCount += 1;
        if (isNonEmptyText(requirement?.sourceRef)) sourceRefCount += 1;
        if (isNonEmptyText(requirement?.obligationStrength)) obligationCount += 1;
      }

      rubricCount += Array.isArray(subcategory.rubrics) ? subcategory.rubrics.length : 0;
    }
  }

  return {
    controlCount,
    rubricCount,
    sourceRefCoverage: controlCount > 0 ? sourceRefCount / controlCount : 0,
    obligationCoverage: controlCount > 0 ? obligationCount / controlCount : 0
  };
}

function applyModeValidation(requestedMode, metrics, config) {
  if (requestedMode === "sammy") {
    const sammyRules = config.validation?.sammy || {};
    const fallback = safeMode(sammyRules.fallbackMode, "default");
    if (sammyRules.requireRubrics && metrics.rubricCount <= 0) {
      return {
        effectiveMode: fallback,
        downgraded: true,
        reason: `sammy requires rubrics but rubricCount=${metrics.rubricCount}`
      };
    }
  }

  if (requestedMode === "regulation") {
    const regulationRules = config.validation?.regulation || {};
    const fallback = safeMode(regulationRules.fallbackMode, "default");
    const minSourceRefCoverage = Number(regulationRules.minSourceRefCoverage ?? 0);
    const minObligationCoverage = Number(regulationRules.minObligationCoverage ?? 0);

    if (metrics.sourceRefCoverage < minSourceRefCoverage || metrics.obligationCoverage < minObligationCoverage) {
      return {
        effectiveMode: fallback,
        downgraded: true,
        reason:
          `regulation requires sourceRef>=${minSourceRefCoverage} and obligation>=${minObligationCoverage}; ` +
          `actual sourceRef=${metrics.sourceRefCoverage.toFixed(2)}, obligation=${metrics.obligationCoverage.toFixed(2)}`
      };
    }
  }

  return {
    effectiveMode: requestedMode,
    downgraded: false,
    reason: null
  };
}

function resolveFallbackMode(framework) {
  const sourceType = safeLower(framework?.source?.type);
  const totalRubrics = Number(framework?.stats?.totalRubrics || 0);
  const hasRubrics = totalRubrics > 0;
  const isRegulationFramework =
    framework.type === "regulation" ||
    framework.type === "compliance" ||
    String(framework.id || "").startsWith("cn-") ||
    String(framework.id || "").startsWith("eu-");

  if (isRegulationFramework) return "regulation";
  if (hasRubrics || sourceType === "sammy-browse-snapshot") return "sammy";
  return "default";
}

function formatRatio(value) {
  return `${(value * 100).toFixed(1)}%`;
}

async function readJson(path) {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

async function getFrameworkFiles() {
  const files = await fs.readdir(DATA_DIR);
  return files
    .filter((file) => file.endsWith(".json"))
    .filter((file) => file !== "index.json" && file !== "index-en.json")
    .sort();
}

function inferLanguageFromFile(fileName, framework) {
  const fromData = safeLower(framework?.language);
  if (fromData === "zh" || fromData === "en") return fromData;
  return fileName.endsWith("-en.json") ? "en" : "zh";
}

function countByMode(rows, key) {
  const result = { default: 0, sammy: 0, regulation: 0 };
  for (const row of rows) {
    const value = row[key];
    if (VALID_MODES.has(value)) result[value] += 1;
  }
  return result;
}

async function main() {
  const config = await readJson(DISPLAY_PROFILE_CONFIG_PATH);
  const files = await getFrameworkFiles();
  const selectedFiles = frameworkOnly
    ? files.filter((file) => file === `${frameworkOnly}.json` || file === `${frameworkOnly}-en.json`)
    : files;

  if (selectedFiles.length === 0) {
    console.error(`[ERROR] No framework files matched${frameworkOnly ? ` --framework=${frameworkOnly}` : ""}`);
    process.exit(1);
  }

  const rows = [];
  const violations = [];
  const warnings = [];
  const frameworkIdsFromData = new Set();

  for (const file of selectedFiles) {
    const fullPath = join(DATA_DIR, file);
    const framework = await readJson(fullPath);
    const frameworkId = String(framework.id || "").trim();
    const language = inferLanguageFromFile(file, framework);
    frameworkIdsFromData.add(frameworkId);

    const configuredModeRaw = resolveConfiguredMode(framework, config);
    const configuredMode = configuredModeRaw ? safeMode(configuredModeRaw, null) : null;
    if (configuredModeRaw && !configuredMode) {
      violations.push({
        file,
        frameworkId,
        language,
        type: "invalid_mode_in_config",
        details: `frameworkModes/defaultModeByType resolved to "${configuredModeRaw}" which is not allowed`
      });
    }

    const fallbackMode = resolveFallbackMode(framework);
    const requestedMode = configuredMode || fallbackMode;
    const metrics = collectFrameworkDisplayMetrics(framework);
    const validation = applyModeValidation(requestedMode, metrics, config);

    const row = {
      file,
      frameworkId,
      language,
      type: String(framework.type || ""),
      configuredMode: configuredMode || "n/a",
      requestedMode,
      effectiveMode: validation.effectiveMode,
      downgraded: validation.downgraded,
      downgradeReason: validation.reason,
      controlCount: metrics.controlCount,
      rubricCount: metrics.rubricCount,
      sourceRefCoverage: metrics.sourceRefCoverage,
      obligationCoverage: metrics.obligationCoverage
    };
    rows.push(row);

    if (validation.downgraded) {
      violations.push({
        file,
        frameworkId,
        language,
        type: "mode_data_mismatch",
        details:
          `requested=${requestedMode}, effective=${validation.effectiveMode}; ${validation.reason}. ` +
          `controlCount=${metrics.controlCount}, rubricCount=${metrics.rubricCount}, ` +
          `sourceRefCoverage=${formatRatio(metrics.sourceRefCoverage)}, obligationCoverage=${formatRatio(metrics.obligationCoverage)}`
      });
    }

    if (!configuredMode) {
      warnings.push({
        file,
        frameworkId,
        language,
        type: "mode_not_explicitly_configured",
        details: `no explicit frameworkModes entry; resolved by type/fallback to "${requestedMode}"`
      });
    }
  }

  if (!frameworkOnly) {
    for (const configuredFrameworkId of Object.keys(config.frameworkModes || {})) {
      if (!frameworkIdsFromData.has(configuredFrameworkId)) {
        warnings.push({
          file: "-",
          frameworkId: configuredFrameworkId,
          language: "-",
          type: "configured_framework_not_found",
          details: "framework id exists in framework-display-profiles.json but no corresponding data file was checked"
        });
      }
    }
  }

  const summary = {
    checkedAt: new Date().toISOString(),
    mode,
    frameworkOnly: frameworkOnly || null,
    filesChecked: rows.length,
    frameworksChecked: [...new Set(rows.map((row) => row.frameworkId))].length,
    violations: violations.length,
    warnings: warnings.length,
    requestedModeCounts: countByMode(rows, "requestedMode"),
    effectiveModeCounts: countByMode(rows, "effectiveMode"),
    downgradedRows: rows
      .filter((row) => row.downgraded)
      .map((row) => ({
        file: row.file,
        frameworkId: row.frameworkId,
        language: row.language,
        requestedMode: row.requestedMode,
        effectiveMode: row.effectiveMode,
        reason: row.downgradeReason
      }))
  };

  if (outputPath) {
    const payload = { summary, violations, warnings, rows };
    const outputAbs = outputPath.startsWith("/")
      ? outputPath
      : join(ROOT, outputPath);
    await fs.mkdir(dirname(outputAbs), { recursive: true });
    await fs.writeFile(outputAbs, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  for (const row of rows) {
    const status = row.downgraded ? "FAIL" : "PASS";
    console.log(
      `[${status}] ${row.file} id=${row.frameworkId} lang=${row.language} ` +
      `requested=${row.requestedMode} effective=${row.effectiveMode} controls=${row.controlCount} rubrics=${row.rubricCount} ` +
      `sourceRef=${formatRatio(row.sourceRefCoverage)} obligation=${formatRatio(row.obligationCoverage)}`
    );
  }

  for (const warning of warnings) {
    console.warn(`[WARN] ${warning.type} ${warning.frameworkId} ${warning.language} ${warning.details}`);
  }

  for (const violation of violations) {
    console.error(`[VIOLATION] ${violation.type} ${violation.frameworkId} ${violation.language} ${violation.details}`);
  }

  console.log(`[SUMMARY] ${JSON.stringify(summary)}`);

  if (FAIL_ON_VIOLATION && violations.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
