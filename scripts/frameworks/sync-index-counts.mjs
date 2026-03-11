#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'public/data/frameworks');
const INDEX_EN_PATH = join(DATA_DIR, 'index-en.json');
const INDEX_ZH_PATH = join(DATA_DIR, 'index.json');
const BASELINE_PATH = join(ROOT, 'scripts/frameworks/official-baselines.json');
const dryRun = process.argv.includes('--dry-run');

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
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function countRequirements(framework) {
  let requirements = 0;
  for (const category of framework?.categories || []) {
    for (const subcategory of category?.subcategories || []) {
      for (const requirement of subcategory?.requirements || []) {
        const questionType = String(requirement?.questionType || '').trim().toLowerCase();
        if (questionType === 'rubric') continue;

        if (!questionType) {
          const name = String(requirement?.name || '').trim();
          const description = String(requirement?.description || '').trim();
          const looksLikeRubric =
            Boolean(requirement?.parentControlCode) ||
            /^标签\s*\d+$/i.test(name) ||
            /^tag\s*\d+$/i.test(name) ||
            RUBRIC_NAME_PATTERNS.some((pattern) => pattern.test(name)) ||
            RUBRIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description));
          if (looksLikeRubric) continue;
        }

        requirements += 1;
      }
    }
  }
  return requirements;
}

async function readFrameworkCount(id, lang) {
  const fileName = lang === 'en' ? `${id}-en.json` : `${id}.json`;
  const path = join(DATA_DIR, fileName);
  try {
    const data = await readJson(path);
    return countRequirements(data);
  } catch {
    return null;
  }
}

function updateIndexCounts(indexData, countsById) {
  let updated = 0;
  for (const item of indexData.frameworks || []) {
    const next = countsById.get(item.id);
    if (typeof next !== 'number') {
      continue;
    }
    if (item.requirements !== next) {
      item.requirements = next;
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  const [indexEn, indexZh, baselineRaw] = await Promise.all([
    readJson(INDEX_EN_PATH),
    readJson(INDEX_ZH_PATH),
    readJson(BASELINE_PATH),
  ]);
  const baselines = baselineRaw?.frameworks || {};

  const ids = new Set([
    ...(indexEn.frameworks || []).map(item => item.id),
    ...(indexZh.frameworks || []).map(item => item.id),
  ]);

  const countsById = new Map();
  for (const id of ids) {
    const [enCount, zhCount] = await Promise.all([
      readFrameworkCount(id, 'en'),
      readFrameworkCount(id, 'zh'),
    ]);
    const canonical = baselines[id]?.canonicalLanguage === 'zh' ? 'zh' : 'en';
    const canonicalCount = canonical === 'zh' ? zhCount : enCount;
    const fallbackCount = canonical === 'zh' ? enCount : zhCount;
    const resolved = canonicalCount || fallbackCount || 0;
    if (resolved > 0) {
      countsById.set(id, resolved);
    }
  }

  const updatedEn = updateIndexCounts(indexEn, countsById);
  const updatedZh = updateIndexCounts(indexZh, countsById);

  if (!dryRun) {
    await Promise.all([writeJson(INDEX_EN_PATH, indexEn), writeJson(INDEX_ZH_PATH, indexZh)]);
  }

  console.log(
    `Synced index requirement counts: ids=${countsById.size} updated_en=${updatedEn} updated_zh=${updatedZh} dry_run=${dryRun}`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
