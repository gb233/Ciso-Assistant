'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, Shield, ChevronRight, X } from 'lucide-react';
import { getFrameworks, type SearchItem, type FrameworkMeta } from '@/lib/data-loader';
import { searchRequirements } from '@/lib/search';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function SearchPage() {
  const { language, t, isReady } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [frameworks, setFrameworks] = useState<FrameworkMeta[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    getFrameworks(language).then(setFrameworks);
  }, [language, isReady]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const searchResults = await searchRequirements(query, {
        lang: language,
        frameworkId: selectedFramework || undefined,
        limit: 50
      });
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [query, selectedFramework, language]);

  useEffect(() => {
    const timeoutId = setTimeout(handleSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [handleSearch]);

  const clearFilters = () => {
    setSelectedFramework('');
  };

  const getFrameworkColor = (frameworkId: string) => {
    if (frameworkId.includes('owasp')) return 'bg-purple-100 text-purple-800';
    if (frameworkId.includes('nist')) return 'bg-blue-100 text-blue-800';
    if (frameworkId.includes('cis')) return 'bg-orange-100 text-orange-800';
    if (frameworkId.includes('mlps') || frameworkId.includes('guomi')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const tagLabel = (tag: string) => (language === 'zh' ? `标签 ${tag}` : `Tag ${tag}`);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-900">{t.nav.home}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900">{t.nav.search}</span>
          </div>
          <LanguageSwitcher variant="button" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {language === 'zh' ? '搜索安全要求' : 'Search Security Requirements'}
          </h1>
          <p className="text-gray-600">
            {language === 'zh'
              ? '在框架要求中快速找到您需要的内容'
              : 'Quickly find what you need across framework requirements'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={language === 'zh' ? '搜索要求名称、描述、代码...' : 'Search by requirement name, description, or code...'}
              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">{t.common.filter}:</span>
            </div>

            <select
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{language === 'zh' ? '所有框架' : 'All frameworks'}</option>
              {frameworks.map((fw) => (
                <option key={fw.id} value={fw.id}>{fw.name}</option>
              ))}
            </select>

            {selectedFramework && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              >
                <X className="w-4 h-4 mr-1" />
                {language === 'zh' ? '清除筛选' : 'Clear filters'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">{language === 'zh' ? '搜索中...' : 'Searching...'}</p>
            </div>
          ) : hasSearched ? (
            results.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-600">
                    {language === 'zh' ? '找到' : 'Found'}{' '}
                    <span className="font-semibold text-gray-900">{results.length}</span>{' '}
                    {language === 'zh' ? '个结果' : 'results'}
                  </p>
                </div>

                <div className="space-y-3">
                  {results.map((result) => (
                    <Link
                      key={`${result.frameworkId}-${result.id}`}
                      href={result.path}
                      className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getFrameworkColor(result.frameworkId)}`}>
                              {result.frameworkName}
                            </span>
                            {result.level && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
                                {tagLabel(result.level)}
                              </span>
                            )}
                            <span className="text-xs text-gray-500 font-mono">{result.code}</span>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-1">{result.name}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2">{result.description}</p>
                          <div className="mt-2 text-xs text-gray-500">
                            {result.categoryName} {'>'} {result.subcategoryName}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {language === 'zh' ? '未找到结果' : 'No results found'}
                </h3>
                <p className="text-gray-600">
                  {language === 'zh'
                    ? '尝试使用不同关键词或清除筛选条件'
                    : 'Try different keywords or clear filters'}
                </p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {frameworks.slice(0, 8).map((fw) => (
                <Link
                  key={fw.id}
                  href={`/frameworks/${fw.id}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      fw.region === 'cn' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {fw.region === 'cn' ? (
                        <span className="text-red-600 font-bold">中</span>
                      ) : (
                        <Shield className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{fw.name}</h3>
                      <p className="text-xs text-gray-500">
                        {fw.requirements} {t.framework.requirements}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
