#!/usr/bin/env node

import { promises as fs } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "public/data/frameworks");
const INDEX_ZH = join(DATA_DIR, "index.json");
const INDEX_EN = join(DATA_DIR, "index-en.json");

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

function shouldRemoveRequirement(req) {
  const name = String(req?.name || "").trim();
  return BANNED_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function normalizeText(value) {
  if (typeof value !== "string") return value;
  let next = value;

  // Known extraction artifacts
  next = next.replaceAll("指标omise", "妥协指标（IOC）");
  next = next.replaceAll("及妥协的妥协指标（IOC）", "及妥协指标（IOC）");

  return next;
}

function recalcStats(framework) {
  let totalRequirements = 0;
  let totalSubcategories = 0;
  let level1 = 0;
  let level2 = 0;
  let level3 = 0;

  for (const category of framework.categories || []) {
    let categoryCount = 0;
    totalSubcategories += (category.subcategories || []).length;

    for (const subcategory of category.subcategories || []) {
      const reqs = Array.isArray(subcategory.requirements) ? subcategory.requirements : [];
      categoryCount += reqs.length;
      totalRequirements += reqs.length;

      for (const req of reqs) {
        const lv = String(req.level || "").trim();
        if (lv === "1") level1 += 1;
        if (lv === "2") level2 += 1;
        if (lv === "3") level3 += 1;
      }
    }

    category.requirements = categoryCount;
  }

  framework.stats = {
    ...(framework.stats || {}),
    totalRequirements,
    totalCategories: (framework.categories || []).length,
    totalSubcategories,
    level1,
    level2,
    level3
  };

  return totalRequirements;
}

async function readJson(path) {
  const raw = await fs.readFile(path, "utf8");
  return JSON.parse(raw);
}

async function writeJson(path, data) {
  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const entries = await fs.readdir(DATA_DIR);
  const frameworkFiles = entries
    .filter((name) => name.endsWith(".json"))
    .filter((name) => name !== "index.json" && name !== "index-en.json")
    .sort();

  const totalsByFrameworkId = new Map();
  let changedFiles = 0;
  let removedRows = 0;

  for (const filename of frameworkFiles) {
    const fullPath = join(DATA_DIR, filename);
    const framework = await readJson(fullPath);

    let localRemoved = 0;
    for (const category of framework.categories || []) {
      for (const subcategory of category.subcategories || []) {
        const requirements = Array.isArray(subcategory.requirements) ? subcategory.requirements : [];
        const filtered = requirements
          .filter((req) => !shouldRemoveRequirement(req))
          .map((req) => ({
            ...req,
            name: normalizeText(req.name),
            description: normalizeText(req.description),
            verification: normalizeText(req.verification)
          }));

        localRemoved += requirements.length - filtered.length;
        subcategory.requirements = filtered;
      }
    }

    const totalRequirements = recalcStats(framework);
    totalsByFrameworkId.set(framework.id, totalRequirements);

    if (localRemoved > 0) {
      changedFiles += 1;
      removedRows += localRemoved;
    }

    await writeJson(fullPath, framework);
  }

  for (const indexPath of [INDEX_ZH, INDEX_EN]) {
    const index = await readJson(indexPath);
    let touched = 0;

    for (const item of index.frameworks || []) {
      const total = totalsByFrameworkId.get(item.id);
      if (typeof total === "number" && item.requirements !== total) {
        item.requirements = total;
        touched += 1;
      }
    }

    await writeJson(indexPath, index);
    console.log(`[index] ${indexPath.replace(`${ROOT}/`, "")}: updated=${touched}`);
  }

  console.log(
    `[sanitize] frameworkFiles=${frameworkFiles.length} changedFiles=${changedFiles} removedRows=${removedRows}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
