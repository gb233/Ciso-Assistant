/**
 * 搜索功能（客户端专用）
 * 使用 Fuse.js 进行模糊搜索
 */

import Fuse from 'fuse.js';
import { getFrameworks, getFramework, type SearchItem } from './data-loader';
import { normalizeLanguage } from './i18n';

const fuseInstanceByLang: Partial<Record<'zh' | 'en', Fuse<SearchItem>>> = {};

/**
 * 初始化搜索索引
 */
export async function initSearchIndex(lang?: string): Promise<Fuse<SearchItem>> {
  const resolvedLang = normalizeLanguage(lang);
  if (fuseInstanceByLang[resolvedLang]) {
    return fuseInstanceByLang[resolvedLang] as Fuse<SearchItem>;
  }

  const frameworks = await getFrameworks(resolvedLang);
  const searchItems: SearchItem[] = [];

  for (const frameworkMeta of frameworks) {
    const framework = await getFramework(frameworkMeta.id, resolvedLang);
    if (!framework) continue;

    framework.categories.forEach(category => {
      category.subcategories.forEach(subcategory => {
        subcategory.requirements.forEach(req => {
          searchItems.push({
            id: req.id,
            code: req.code,
            name: req.name,
            description: req.description,
            frameworkId: framework.id,
            frameworkName: framework.name,
            categoryName: category.name,
            subcategoryName: subcategory.name,
            level: req.level,
            path: `/frameworks/${framework.id}/requirements/${req.id}`
          });
        });
      });
    });
  }

  const fuse = new Fuse(searchItems, {
    keys: [
      { name: 'name', weight: 0.4 },
      { name: 'description', weight: 0.3 },
      { name: 'code', weight: 0.2 },
      { name: 'frameworkName', weight: 0.1 }
    ],
    threshold: 0.3,
    includeScore: true,
    includeMatches: true
  });

  fuseInstanceByLang[resolvedLang] = fuse;
  return fuse;
}

/**
 * 搜索要求
 */
export async function searchRequirements(
  query: string,
  options?: {
    lang?: string;
    frameworkId?: string;
    limit?: number;
  }
): Promise<SearchItem[]> {
  const fuse = await initSearchIndex(options?.lang);

  let results = fuse.search(query).map(result => result.item);

  if (options?.frameworkId) {
    results = results.filter(item => item.frameworkId === options.frameworkId);
  }

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * 清除搜索缓存
 */
export function clearSearchCache(): void {
  delete fuseInstanceByLang.zh;
  delete fuseInstanceByLang.en;
}
