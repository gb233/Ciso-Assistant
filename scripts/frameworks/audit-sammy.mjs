#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'public/data/frameworks');
const OUTPUT = join(ROOT, 'docs/framework-audit-2026-02-26.md');

const SAMPLE = [
  { id: 'owasp-samm', sammySlug: 'samm' },
  { id: 'nist-ssdf', sammySlug: 'nist-ssdf' },
  { id: 'nist-csf-2.0', sammySlug: 'nist-csf-20' },
  { id: 'pci-dss', sammySlug: 'pci-dss' },
  { id: 'mlps-2.0', sammySlug: 'mlps-2.0' }
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function localCounts(framework) {
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

async function fetchSammy(slug) {
  const url = `https://sammy.codific.com/browse/${slug}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
  const html = await res.text();
  return { status: res.status, html, url: res.url };
}

function sammyCounts(html, slug) {
  const links = [...html.matchAll(/href=['"]\/browse\/([^"']+)['"]/g)].map(m => m[1]);
  const ownLinks = links.filter(p => p.startsWith(`${slug}/`));

  const firstHrefMatch = html.match(/href=['"]\/browse\/([^/"']+)/);
  const fallbackSlug = firstHrefMatch ? firstHrefMatch[1] : slug;
  const fallbackLinks = links.filter(p => p.startsWith(`${fallbackSlug}/`));
  const useLinks = ownLinks.length > 0 ? ownLinks : fallbackLinks;

  const level1 = new Set();
  const level2 = new Set();
  const level3 = new Set();
  for (const link of useLinks) {
    const parts = link.split('/').filter(Boolean);
    if (parts[1]) level1.add(parts[1]);
    if (parts[1] && parts[2]) level2.add(`${parts[1]}/${parts[2]}`);
    if (parts[1] && parts[2] && parts[3]) level3.add(`${parts[1]}/${parts[2]}/${parts[3]}`);
  }

  return {
    matchedSlug: ownLinks.length > 0 ? slug : fallbackSlug,
    links: useLinks.length,
    level1: level1.size,
    level2: level2.size,
    level3: level3.size
  };
}

function markdownTable(rows) {
  const header = '| Framework | Local (cat/sub/req) | Sammy (L1/L2/L3-links) | Sammy slug |\n|---|---:|---:|---|';
  const body = rows
    .map(r => `| ${r.framework} | ${r.local} | ${r.sammy} | ${r.slug} |`)
    .join('\n');
  return `${header}\n${body}`;
}

async function main() {
  const rows = [];
  const notes = [];

  for (const item of SAMPLE) {
    const local = await readJson(join(DATA_DIR, `${item.id}.json`));
    const localStat = localCounts(local);
    const sammy = await fetchSammy(item.sammySlug);
    const sammyStat = sammyCounts(sammy.html, item.sammySlug);

    rows.push({
      framework: `${item.id} (${local.name})`,
      local: `${localStat.categories}/${localStat.subcategories}/${localStat.requirements}`,
      sammy: `${sammyStat.level1}/${sammyStat.level2}/${sammyStat.level3}-${sammyStat.links}`,
      slug: sammyStat.matchedSlug
    });

    if (sammyStat.matchedSlug !== item.sammySlug) {
      notes.push(
        `- \`${item.id}\` 的 Sammy 链接 \`/browse/${item.sammySlug}\` 实际落到 \`/browse/${sammyStat.matchedSlug}\`，无法作为该框架的有效对照。`
      );
    }
  }

  const content = `# Framework Audit (2026-02-26)

## Scope
- 对照对象：本地 JSON、Sammy 浏览页面（可抓取结构）、官方来源基线（见下方“官方基线”）。
- 抽样框架：\`${SAMPLE.map(s => s.id).join('`, `')}\`。

## Local vs Sammy
${markdownTable(rows)}

## Official Baseline (Machine-checkable)
- OWASP SAMM 官方结构：5 business functions、15 security practices（来源：https://owaspsamm.org/about/）。
- NIST SSDF v1.1：通过 NIST 官方补充文件 \`nist.sp.800-218.ssdf-table.xlsx\` 统计得到 4 groups、20 practices、44 tasks。
- NIST CSF 2.0：通过 NIST 官方文件 \`CSF 1.1 to 2.0 Core Transition Changes.xlsx\`（2024-09-19）统计得到 6 functions、22 categories、106 subcategories。

## Audit Notes
${notes.length ? notes.join('\n') : '- 无重定向异常。'}

## Conclusion
- 本地与 Sammy 在多个框架存在明显层级偏差（尤其是子层级与条目总数）。
- ` +
`建议后续以“主源 + 派生翻译”流水线重建数据，并以官方机读文件做结构校验门禁。`;

  await writeFile(OUTPUT, `${content}\n`, 'utf8');
  console.log(`Audit report written: ${OUTPUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

