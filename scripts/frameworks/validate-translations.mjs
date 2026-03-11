#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { join } from 'path';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'public/data/frameworks');
const CJK_RE = /[\u3400-\u9FFF]/;
const EN_CJK_ALLOWLIST = new Set([
  'cn-cybersecurity-law',
  'cn-data-security-law',
  'cn-personal-information-protection-law'
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function collectStringStats(node) {
  let total = 0;
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
    if (typeof value === 'string') {
      total += 1;
      if (CJK_RE.test(value)) cjk += 1;
    }
  };
  walk(node);
  return { totalStrings: total, cjkStrings: cjk };
}

function hierarchy(framework) {
  const categories = framework.categories?.length || 0;
  let subcategories = 0;
  let requirements = 0;
  for (const c of framework.categories || []) {
    subcategories += c.subcategories?.length || 0;
    for (const s of c.subcategories || []) {
      requirements += s.requirements?.length || 0;
    }
  }
  return { categories, subcategories, requirements };
}

async function main() {
  const indexZh = await readJson(join(DATA_DIR, 'index.json'));
  const indexEn = await readJson(join(DATA_DIR, 'index-en.json'));
  const ids = indexZh.frameworks.map(f => f.id);
  const issues = [];

  if (indexZh.frameworks.length !== indexEn.frameworks.length) {
    issues.push(`index size mismatch: zh=${indexZh.frameworks.length}, en=${indexEn.frameworks.length}`);
  }

  for (const id of ids) {
    const zh = await readJson(join(DATA_DIR, `${id}.json`));
    const en = await readJson(join(DATA_DIR, `${id}-en.json`));

    const zhH = hierarchy(zh);
    const enH = hierarchy(en);
    if (
      zhH.categories !== enH.categories ||
      zhH.subcategories !== enH.subcategories ||
      zhH.requirements !== enH.requirements
    ) {
      issues.push(
        `[${id}] hierarchy mismatch zh(${zhH.categories}/${zhH.subcategories}/${zhH.requirements}) vs en(${enH.categories}/${enH.subcategories}/${enH.requirements})`
      );
    }

    const zhStats = collectStringStats(zh);
    const enStats = collectStringStats(en);

    if (enStats.cjkStrings > 0 && !EN_CJK_ALLOWLIST.has(id)) {
      issues.push(`[${id}] English file still contains Chinese strings: ${enStats.cjkStrings}`);
    }

    if (zhStats.cjkStrings === 0) {
      issues.push(`[${id}] Chinese file has zero Chinese strings`);
    }
  }

  if (issues.length > 0) {
    console.log('Validation failed:');
    for (const issue of issues) {
      console.log(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Validation passed for ${ids.length} frameworks.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
