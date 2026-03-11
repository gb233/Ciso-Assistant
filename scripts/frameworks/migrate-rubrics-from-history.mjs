#!/usr/bin/env node

import { execFileSync } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "public/data/frameworks");
const SOURCE_REF = getArgValue("--source-ref") || "81f82f5^";

const TARGET_FRAMEWORK_IDS = [
  "bsimm-15",
  "cis-csc-v8",
  "cloud-controls-matrix",
  "cyberfundamentals-20",
  "nis2",
  "nist-800-171",
  "nist-800-34",
  "nist-800-53",
  "owasp-samm",
  "secure-controls-framework"
];

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
];

function getArgValue(name) {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.findIndex((arg) => arg === name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return null;
}

function isRubricRequirement(requirement) {
  const name = String(requirement?.name || "").trim();
  return RUBRIC_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function toSubcategoryMap(framework) {
  const map = new Map();
  for (const category of framework.categories || []) {
    for (const subcategory of category.subcategories || []) {
      map.set(`${category.id}::${subcategory.id}`, subcategory);
    }
  }
  return map;
}

function normalizeRubric(rubric, fallbackId, parentControlCode) {
  return {
    ...rubric,
    id: rubric.id || fallbackId,
    questionType: "rubric",
    parentControlCode: parentControlCode || rubric.parentControlCode
  };
}

function extractRubrics(oldRequirements, fallbackControlCode) {
  const rubrics = [];
  let lastControlCode = fallbackControlCode || null;
  let rubricSequence = 1;

  for (const requirement of oldRequirements || []) {
    if (isRubricRequirement(requirement)) {
      rubrics.push(
        normalizeRubric(
          requirement,
          `${String(requirement?.code || "rubric").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${rubricSequence++}`,
          lastControlCode
        )
      );
      continue;
    }

    const controlCode = String(requirement?.code || "").trim();
    if (controlCode) {
      lastControlCode = controlCode;
    }
  }

  return rubrics;
}

function readJsonFromGit(relativePath) {
  const stdout = execFileSync(
    "git",
    ["show", `${SOURCE_REF}:${relativePath}`],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 300
    }
  );
  return JSON.parse(stdout);
}

function countRubrics(framework) {
  let total = 0;
  for (const category of framework.categories || []) {
    for (const subcategory of category.subcategories || []) {
      total += (subcategory.rubrics || []).length;
    }
  }
  return total;
}

async function writeJson(path, data) {
  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function runOne(relativePath) {
  const absolutePath = join(ROOT, relativePath);
  const currentRaw = await fs.readFile(absolutePath, "utf8");
  const current = JSON.parse(currentRaw);
  const previous = readJsonFromGit(relativePath);

  const previousSubMap = toSubcategoryMap(previous);
  let added = 0;

  for (const category of current.categories || []) {
    for (const subcategory of category.subcategories || []) {
      const key = `${category.id}::${subcategory.id}`;
      const previousSubcategory = previousSubMap.get(key);
      if (!previousSubcategory) continue;

      const fallbackControlCode = subcategory.requirements?.[0]?.code
        ? String(subcategory.requirements[0].code)
        : null;

      const recovered = extractRubrics(previousSubcategory.requirements || [], fallbackControlCode);
      if (recovered.length === 0) continue;

      const merged = new Map();
      for (const rubric of subcategory.rubrics || []) {
        const keyId = rubric.id || `${rubric.code}-${rubric.name}`;
        merged.set(keyId, {
          ...rubric,
          questionType: "rubric"
        });
      }
      for (const rubric of recovered) {
        const keyId = rubric.id || `${rubric.code}-${rubric.name}`;
        if (!merged.has(keyId)) {
          merged.set(keyId, rubric);
          added += 1;
        }
      }

      subcategory.rubrics = Array.from(merged.values());
    }
  }

  const totalRubrics = countRubrics(current);
  current.stats = {
    ...(current.stats || {}),
    totalRubrics
  };

  const nextRaw = `${JSON.stringify(current, null, 2)}\n`;
  if (nextRaw === currentRaw) {
    return {
      file: relativePath,
      changed: false,
      added: 0,
      totalRubrics: totalRubrics
    };
  }

  await writeJson(absolutePath, current);
  return {
    file: relativePath,
    changed: true,
    added,
    totalRubrics
  };
}

async function main() {
  const targets = [];
  for (const frameworkId of TARGET_FRAMEWORK_IDS) {
    targets.push(`public/data/frameworks/${frameworkId}.json`);
    targets.push(`public/data/frameworks/${frameworkId}-en.json`);
  }

  const results = [];
  for (const relativePath of targets) {
    try {
      const stat = await fs.stat(join(ROOT, relativePath));
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }
    results.push(await runOne(relativePath));
  }

  const changed = results.filter((result) => result.changed);
  const totalAdded = changed.reduce((sum, result) => sum + result.added, 0);
  console.log(`[rubrics:migrate] sourceRef=${SOURCE_REF} targets=${results.length} changed=${changed.length} added=${totalAdded}`);
  for (const result of changed) {
    console.log(
      `  - ${result.file.replace(`${ROOT}/`, "")} added=${result.added} totalRubrics=${result.totalRubrics}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
