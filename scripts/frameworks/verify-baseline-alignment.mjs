#!/usr/bin/env node

import { promises as fs } from "fs";
import { dirname, join } from "path";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "public/data/frameworks");
const BASELINE_PATH = join(ROOT, "scripts/frameworks/official-baselines.json");

const args = process.argv.slice(2);
const mode = (getArgValue("--mode") || "report").toLowerCase();
const frameworkOnly = getArgValue("--framework");
const outputPath = getArgValue("--output");

const FAIL_ON_ERROR = mode === "ci" || mode === "strict";

function getArgValue(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.findIndex((arg) => arg === name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return null;
}

function safeText(value) {
  return String(value || "").trim();
}

async function readJson(path) {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function countFrameworkItems(framework) {
  let controls = 0;
  let rubrics = 0;

  for (const category of framework.categories || []) {
    for (const subcategory of category.subcategories || []) {
      for (const requirement of subcategory.requirements || []) {
        const questionType = safeText(requirement?.questionType).toLowerCase();
        if (questionType === "rubric") {
          rubrics += 1;
          continue;
        }
        controls += 1;
      }
      rubrics += Array.isArray(subcategory.rubrics) ? subcategory.rubrics.length : 0;
    }
  }

  return {
    controls,
    rubrics,
    totalItems: controls + rubrics
  };
}

function pushError(errors, payload) {
  errors.push(payload);
}

function pushWarning(warnings, payload) {
  warnings.push(payload);
}

async function main() {
  const baselineRaw = await readJson(BASELINE_PATH);
  const baselineMap = baselineRaw?.frameworks || {};
  const frameworkIds = frameworkOnly
    ? Object.keys(baselineMap).filter((id) => id === frameworkOnly)
    : Object.keys(baselineMap).sort();

  if (frameworkIds.length === 0) {
    console.error(`[ERROR] No baseline entries matched${frameworkOnly ? ` --framework=${frameworkOnly}` : ""}`);
    process.exit(1);
  }

  const rows = [];
  const errors = [];
  const warnings = [];

  for (const frameworkId of frameworkIds) {
    const baseline = baselineMap[frameworkId] || {};
    const canonicalLanguage = baseline.canonicalLanguage === "zh" ? "zh" : "en";
    const fileName = canonicalLanguage === "en" ? `${frameworkId}-en.json` : `${frameworkId}.json`;
    const fullPath = join(DATA_DIR, fileName);

    if (!(await exists(fullPath))) {
      pushError(errors, {
        frameworkId,
        file: fileName,
        type: "missing_canonical_file",
        details: `Canonical language=${canonicalLanguage} file is missing`
      });
      continue;
    }

    const framework = await readJson(fullPath);
    const counts = countFrameworkItems(framework);
    const expectedRequirements = Number(baseline.expectedRequirements ?? 0);
    const hasExpectedControls = baseline.expectedControls !== undefined;
    const hasExpectedRubrics = baseline.expectedRubrics !== undefined;
    const expectedControls = Number(baseline.expectedControls ?? 0);
    const expectedRubrics = Number(baseline.expectedRubrics ?? 0);
    const coverageStatus = safeText(baseline.coverageStatus || "full").toLowerCase();
    const coverageNote = safeText(baseline.coverageNote);
    const sourceType = safeText(framework?.source?.type);

    rows.push({
      frameworkId,
      canonicalLanguage,
      file: fileName,
      sourceType: sourceType || "(missing)",
      expectedRequirements,
      expectedControls: hasExpectedControls ? expectedControls : null,
      expectedRubrics: hasExpectedRubrics ? expectedRubrics : null,
      controls: counts.controls,
      rubrics: counts.rubrics,
      totalItems: counts.totalItems,
      delta: counts.totalItems - expectedRequirements,
      coverageStatus
    });

    if (!sourceType) {
      pushError(errors, {
        frameworkId,
        file: fileName,
        type: "missing_source_type",
        details: "framework.source.type is empty"
      });
    }

    if (coverageStatus === "full") {
      if (counts.totalItems !== expectedRequirements) {
        pushError(errors, {
          frameworkId,
          file: fileName,
          type: "full_coverage_count_mismatch",
          details: `expected=${expectedRequirements}, actual=${counts.totalItems}`
        });
      }

      if (hasExpectedControls && counts.controls !== expectedControls) {
        pushError(errors, {
          frameworkId,
          file: fileName,
          type: "full_coverage_controls_mismatch",
          details: `expectedControls=${expectedControls}, actualControls=${counts.controls}`
        });
      }

      if (hasExpectedRubrics && counts.rubrics !== expectedRubrics) {
        pushError(errors, {
          frameworkId,
          file: fileName,
          type: "full_coverage_rubrics_mismatch",
          details: `expectedRubrics=${expectedRubrics}, actualRubrics=${counts.rubrics}`
        });
      }
    } else if (coverageStatus === "partial") {
      if (!coverageNote) {
        pushError(errors, {
          frameworkId,
          file: fileName,
          type: "partial_coverage_note_missing",
          details: "coverageStatus=partial requires non-empty coverageNote in official-baselines.json"
        });
      }
      if (counts.totalItems > expectedRequirements) {
        pushError(errors, {
          frameworkId,
          file: fileName,
          type: "partial_coverage_exceeds_expected",
          details: `partial coverage should not exceed baseline expected=${expectedRequirements}, actual=${counts.totalItems}`
        });
      } else if (counts.totalItems < expectedRequirements) {
        pushWarning(warnings, {
          frameworkId,
          file: fileName,
          type: "partial_coverage_gap",
          details: `declared partial: expected=${expectedRequirements}, actual=${counts.totalItems}`
        });
      }

      if (hasExpectedControls && counts.controls > expectedControls) {
        pushError(errors, {
          frameworkId,
          file: fileName,
          type: "partial_coverage_controls_exceeds_expected",
          details: `partial controls should not exceed expectedControls=${expectedControls}, actualControls=${counts.controls}`
        });
      }

      if (hasExpectedRubrics && counts.rubrics > expectedRubrics) {
        pushError(errors, {
          frameworkId,
          file: fileName,
          type: "partial_coverage_rubrics_exceeds_expected",
          details: `partial rubrics should not exceed expectedRubrics=${expectedRubrics}, actualRubrics=${counts.rubrics}`
        });
      }
    } else {
      pushError(errors, {
        frameworkId,
        file: fileName,
        type: "invalid_coverage_status",
        details: `coverageStatus must be full|partial, got "${coverageStatus}"`
      });
    }
  }

  const summary = {
    checkedAt: new Date().toISOString(),
    mode,
    frameworkOnly: frameworkOnly || null,
    checkedFrameworks: rows.length,
    errors: errors.length,
    warnings: warnings.length
  };

  for (const row of rows) {
    const status = row.delta === 0 ? "OK" : (row.coverageStatus === "partial" ? "PARTIAL" : "DIFF");
    console.log(
      `[${status}] ${row.frameworkId} file=${row.file} expected=${row.expectedRequirements} ` +
      `controls=${row.controls} rubrics=${row.rubrics} total=${row.totalItems} delta=${row.delta} sourceType=${row.sourceType}`
    );
  }

  for (const warning of warnings) {
    console.warn(`[WARN] ${warning.type} ${warning.frameworkId} ${warning.details}`);
  }
  for (const error of errors) {
    console.error(`[ERROR] ${error.type} ${error.frameworkId} ${error.details}`);
  }

  console.log(`[SUMMARY] ${JSON.stringify(summary)}`);

  if (outputPath) {
    const payload = { summary, rows, warnings, errors };
    const outputAbs = outputPath.startsWith("/") ? outputPath : join(ROOT, outputPath);
    await fs.mkdir(dirname(outputAbs), { recursive: true });
    await fs.writeFile(outputAbs, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  if (FAIL_ON_ERROR && errors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
