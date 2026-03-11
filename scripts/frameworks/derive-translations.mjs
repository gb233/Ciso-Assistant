#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { translate as bingTranslate } from 'bing-translate-api';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'public/data/frameworks');
const CONFIG_PATH = join(ROOT, 'scripts/frameworks/pipeline.config.json');
const CJK_RE = /[\u3400-\u9FFF]/;
const LATIN_RE = /[A-Za-z]/;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyFrameworkArg = args.find(a => a.startsWith('--framework='));
const onlyFramework = onlyFrameworkArg ? onlyFrameworkArg.split('=')[1] : null;
const cacheArg = args.find(a => a.startsWith('--cache='));
const cachePath = cacheArg ? cacheArg.split('=')[1] : join(ROOT, 'scripts/frameworks/.translation-cache.json');

function parseIntArg(name, fallback) {
  const arg = args.find(a => a.startsWith(`${name}=`));
  if (!arg) return fallback;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function googleTranslate(text, sourceLang, targetLang, timeoutMs) {
  const sl = sourceLang === 'zh-Hans' ? 'zh-CN' : sourceLang;
  const tl = targetLang === 'zh-Hans' ? 'zh-CN' : targetLang;
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', sl);
  url.searchParams.set('tl', tl);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const body = await resp.json();
    const translated = Array.isArray(body?.[0])
      ? body[0].map(item => item?.[0] || '').join('').trim()
      : '';
    if (!translated) {
      throw new Error('Empty translation');
    }
    return translated;
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeIdentifier(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return true;
  if (/^https?:\/\//i.test(v)) return true;
  if (/^[0-9]+([.:-][0-9A-Za-z]+)*$/.test(v)) return true;
  if (/^[A-Z0-9_.\-/:]{2,}$/.test(v) && !/\s/.test(v)) return true;
  if (/^[A-Za-z0-9_.\-/:]{1,30}$/.test(v) && !/\s/.test(v)) return true;
  return false;
}

function chunkText(input, chunkSize) {
  if (input.length <= chunkSize) return [input];
  const split = input.split(/(?<=[。！？.!?;；])\s*/g).filter(Boolean);
  if (split.length === 1) {
    const parts = [];
    for (let i = 0; i < input.length; i += chunkSize) {
      parts.push(input.slice(i, i + chunkSize));
    }
    return parts;
  }
  const out = [];
  let buf = '';
  for (const seg of split) {
    if ((buf + seg).length > chunkSize && buf) {
      out.push(buf);
      buf = seg;
    } else {
      buf += seg;
    }
  }
  if (buf) out.push(buf);
  return out;
}

async function readJson(path) {
  const text = await readFile(path, 'utf8');
  return JSON.parse(text);
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function loadCache(path) {
  try {
    const data = await readJson(path);
    if (!data || typeof data !== 'object') {
      return new Map();
    }
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

async function persistCache(path, cache) {
  if (!cache || cache.size === 0) return;
  await writeJson(path, Object.fromEntries(cache.entries()));
}

function countCjkStrings(node) {
  let count = 0;
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
      count += 1;
    }
  };
  walk(node);
  return count;
}

function isTranslatableString(value, key, targetLang, skipKeys) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (skipKeys.has(key)) return false;
  if (looksLikeIdentifier(trimmed)) return false;

  if (targetLang === 'en') {
    return CJK_RE.test(trimmed);
  }
  return LATIN_RE.test(trimmed) && !CJK_RE.test(trimmed);
}

function collectTranslatableStrings(node, targetLang, skipKeys) {
  const out = new Set();

  const walk = (value, key = '') => {
    if (Array.isArray(value)) {
      value.forEach(item => walk(item, key));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        walk(v, k);
      }
      return;
    }
    if (isTranslatableString(value, key, targetLang, skipKeys)) {
      out.add(value);
    }
  };

  walk(node);
  return [...out];
}

function applyTranslations(node, targetLang, translations, skipKeys) {
  const walk = (value, key = '') => {
    if (Array.isArray(value)) {
      return value.map(item => walk(item, key));
    }
    if (value && typeof value === 'object') {
      const next = {};
      for (const [k, v] of Object.entries(value)) {
        next[k] = walk(v, k);
      }
      return next;
    }
    if (isTranslatableString(value, key, targetLang, skipKeys)) {
      return translations.get(value) || value;
    }
    return value;
  };
  return walk(node);
}

async function translateText(text, targetLang, cfg) {
  const { chunkSize, requestTimeoutMs, maxRetries, retryBackoffMs } = cfg.translation;
  const sourceLang = targetLang === 'en' ? 'zh-Hans' : 'en';
  const targetBingLang = targetLang === 'en' ? 'en' : 'zh-Hans';
  const chunks = chunkText(text, chunkSize);
  const translatedChunks = [];

  for (const chunk of chunks) {
    let success = false;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const body = await Promise.race([
          bingTranslate(chunk, sourceLang, targetBingLang),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), requestTimeoutMs)
          )
        ]);
        const translated = (body?.translation || '').trim();
        if (!translated) {
          throw new Error('Empty translation');
        }
        translatedChunks.push(translated);
        success = true;
        break;
      } catch (error) {
        // Fallback provider: helps avoid long-tail hangs and transient failures
        // from a single translation backend.
        try {
          const translated = await googleTranslate(chunk, sourceLang, targetBingLang, requestTimeoutMs);
          translatedChunks.push(translated);
          success = true;
          break;
        } catch (googleError) {
          lastError = new Error(`bing=${String(error)}; google=${String(googleError)}`);
          await sleep(retryBackoffMs * attempt);
        }
      }
    }

    if (!success) {
      throw new Error(`Failed to translate chunk: ${String(lastError)}`);
    }
  }

  return translatedChunks.join('');
}

async function runWithConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      out[idx] = await worker(items[idx], idx);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i += 1) {
    workers.push(runner());
  }
  await Promise.all(workers);
  return out;
}

function countHierarchy(framework) {
  const categories = framework.categories?.length || 0;
  let subcategories = 0;
  let requirements = 0;
  for (const category of framework.categories || []) {
    subcategories += category.subcategories?.length || 0;
    for (const sub of category.subcategories || []) {
      requirements += sub.requirements?.length || 0;
    }
  }
  return { categories, subcategories, requirements };
}

async function main() {
  const cfg = await readJson(CONFIG_PATH);
  const indexZh = await readJson(join(DATA_DIR, 'index.json'));
  const frameworkIds = indexZh.frameworks.map(f => f.id).filter(id => !onlyFramework || id === onlyFramework);
  const skipKeys = new Set(cfg.skipKeys || []);
  const concurrency = parseIntArg('--concurrency', cfg.translation?.concurrency || 4);
  const cache = await loadCache(cachePath);
  console.log(`[cache] loaded ${cache.size} entries from ${cachePath.replace(`${ROOT}/`, '')}`);

  let totalTranslatedStrings = 0;
  let totalUpdatedFiles = 0;

  for (const id of frameworkIds) {
    const sourceLang = cfg.sourceLangOverrides?.[id] || cfg.defaultSourceLang || 'zh';
    const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
    const sourcePath = join(DATA_DIR, sourceLang === 'en' ? `${id}-en.json` : `${id}.json`);
    const targetPath = join(DATA_DIR, targetLang === 'en' ? `${id}-en.json` : `${id}.json`);

    const sourceData = await readJson(sourcePath);
    let previousTarget = null;
    try {
      previousTarget = await readJson(targetPath);
    } catch {
      previousTarget = null;
    }

    const strings = collectTranslatableStrings(sourceData, targetLang, skipKeys);
    const missing = strings.filter(s => !cache.has(`${targetLang}:${s}`));

    if (missing.length > 0) {
      console.log(`[${id}] translating ${missing.length} unique strings (${sourceLang} -> ${targetLang})`);
      await runWithConcurrency(missing, concurrency, async text => {
        const key = `${targetLang}:${text}`;
        const translated = await translateText(text, targetLang, cfg);
        cache.set(key, translated);
        totalTranslatedStrings += 1;
      });
      if (!dryRun) {
        await persistCache(cachePath, cache);
      }
    } else {
      console.log(`[${id}] no untranslated strings (${sourceLang} -> ${targetLang})`);
    }

    const translations = new Map();
    for (const s of strings) {
      translations.set(s, cache.get(`${targetLang}:${s}`) || s);
    }

    const next = applyTranslations(sourceData, targetLang, translations, skipKeys);
    next.language = targetLang;
    const sourceHierarchy = countHierarchy(sourceData);
    const targetHierarchy = countHierarchy(next);

    if (
      sourceHierarchy.categories !== targetHierarchy.categories ||
      sourceHierarchy.subcategories !== targetHierarchy.subcategories ||
      sourceHierarchy.requirements !== targetHierarchy.requirements
    ) {
      throw new Error(`[${id}] hierarchy mismatch after translation`);
    }

    const before = previousTarget ? JSON.stringify(previousTarget) : '';
    const after = JSON.stringify(next);
    if (before !== after) {
      totalUpdatedFiles += 1;
      console.log(`[${id}] updating ${targetPath.replace(`${ROOT}/`, '')}`);
      if (!dryRun) {
        await writeJson(targetPath, next);
      }
    } else {
      console.log(`[${id}] no file change`);
    }
  }

  // Keep index files' language labels deterministic.
  const indexEn = await readJson(join(DATA_DIR, 'index-en.json'));
  for (const item of indexEn.frameworks || []) {
    item.language = 'en';
  }
  if (!dryRun) {
    await writeJson(join(DATA_DIR, 'index-en.json'), indexEn);
  }

  const indexZhNext = await readJson(join(DATA_DIR, 'index.json'));
  for (const item of indexZhNext.frameworks || []) {
    item.language = 'zh';
  }
  if (!dryRun) {
    await writeJson(join(DATA_DIR, 'index.json'), indexZhNext);
    await persistCache(cachePath, cache);
  }

  console.log('');
  console.log(`Translation done. translated_strings=${totalTranslatedStrings}, updated_files=${totalUpdatedFiles}, dry_run=${dryRun}`);

  // Post-check: English files should not contain Chinese after cleaning.
  let enChineseCount = 0;
  for (const id of frameworkIds) {
    const enFile = await readJson(join(DATA_DIR, `${id}-en.json`));
    enChineseCount += countCjkStrings(enFile);
  }
  console.log(`Post-check: chinese_strings_in_en=${enChineseCount}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
