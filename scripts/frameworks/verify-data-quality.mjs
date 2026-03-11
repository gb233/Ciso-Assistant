#!/usr/bin/env node

import { promises as fs } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "public/data/frameworks");

const BANNED_NAME_PATTERNS = [
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
];

function isBannedName(value) {
  const name = String(value || "").trim();
  return BANNED_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function analyzeFramework(data) {
  const errors = [];
  const warnings = [];
  let controlRows = 0;
  let rubricRows = 0;

  for (const category of data.categories || []) {
    for (const subcategory of category.subcategories || []) {
      const controls = Array.isArray(subcategory.requirements) ? subcategory.requirements : [];
      const rubrics = Array.isArray(subcategory.rubrics) ? subcategory.rubrics : [];
      const controlCodes = new Set(
        controls
          .map((requirement) => String(requirement?.code || "").trim())
          .filter(Boolean)
      );

      for (const requirement of controls) {
        controlRows += 1;
        const code = String(requirement?.code || "").trim();
        const name = String(requirement?.name || "").trim();
        const questionType = requirement?.questionType;

        if (isBannedName(name)) {
          errors.push({
            type: "banned_name_in_control",
            category: category.name,
            subcategory: subcategory.name,
            code,
            name
          });
        }

        if (questionType === "rubric") {
          errors.push({
            type: "rubric_mixed_into_controls",
            category: category.name,
            subcategory: subcategory.name,
            code,
            name
          });
        }

        if (questionType && questionType !== "control" && questionType !== "rubric") {
          errors.push({
            type: "invalid_question_type_in_controls",
            category: category.name,
            subcategory: subcategory.name,
            code,
            name
          });
        }
      }

      for (const rubric of rubrics) {
        rubricRows += 1;
        const code = String(rubric?.code || "").trim();
        const name = String(rubric?.name || "").trim();
        const questionType = rubric?.questionType;
        const parentControlCode = String(rubric?.parentControlCode || "").trim();

        if (questionType && questionType !== "rubric") {
          errors.push({
            type: "invalid_question_type_in_rubrics",
            category: category.name,
            subcategory: subcategory.name,
            code,
            name
          });
        }

        if (!parentControlCode) {
          errors.push({
            type: "missing_parent_control_code",
            category: category.name,
            subcategory: subcategory.name,
            code,
            name
          });
          continue;
        }

        if (!controlCodes.has(parentControlCode)) {
          warnings.push({
            type: "parent_control_not_found_in_same_subcategory",
            category: category.name,
            subcategory: subcategory.name,
            code,
            parentControlCode
          });
        }
      }
    }
  }

  const statsTotalRubrics = data?.stats?.totalRubrics;
  if (typeof statsTotalRubrics === "number" && statsTotalRubrics !== rubricRows) {
    errors.push({
      type: "stats_total_rubrics_mismatch",
      expected: rubricRows,
      actual: statsTotalRubrics
    });
  }

  if (rubricRows > 0 && typeof statsTotalRubrics !== "number") {
    warnings.push({
      type: "stats_total_rubrics_missing",
      expected: rubricRows
    });
  }

  return {
    errors,
    warnings,
    controlRows,
    rubricRows
  };
}

async function main() {
  const files = (await fs.readdir(DATA_DIR))
    .filter((file) => file.endsWith(".json"))
    .filter((file) => file !== "index.json" && file !== "index-en.json")
    .sort();

  let hasError = false;
  let totalViolations = 0;
  let totalWarnings = 0;
  let totalControlRows = 0;
  let totalRubricRows = 0;

  for (const file of files) {
    const fullPath = join(DATA_DIR, file);
    const data = JSON.parse(await fs.readFile(fullPath, "utf8"));
    const analysis = analyzeFramework(data);
    totalControlRows += analysis.controlRows;
    totalRubricRows += analysis.rubricRows;

    if (analysis.errors.length > 0) {
      hasError = true;
      totalViolations += analysis.errors.length;
      console.error(
        `[FAIL] ${file} id=${data.id} language=${data.language} errors=${analysis.errors.length}`
      );
      for (const row of analysis.errors.slice(0, 5)) {
        console.error(
          `  - ${row.type} | ${row.code || "-"} | ${String(row.name || "").slice(0, 120)}`
        );
      }
    }

    if (analysis.warnings.length > 0) {
      totalWarnings += analysis.warnings.length;
      console.warn(
        `[WARN] ${file} id=${data.id} language=${data.language} warnings=${analysis.warnings.length}`
      );
      for (const warning of analysis.warnings.slice(0, 3)) {
        console.warn(
          `  - ${warning.type} | ${warning.code || "-"} | ${warning.parentControlCode || warning.expected || ""}`
        );
      }
    }
  }

  if (hasError) {
    console.error(`[SUMMARY] data quality errors=${totalViolations} warnings=${totalWarnings}`);
    process.exit(1);
  }

  console.log(
    `[PASS] data quality clean across ${files.length} framework files controls=${totalControlRows} rubrics=${totalRubricRows} warnings=${totalWarnings}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
