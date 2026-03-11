'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Shield, FileText, Lock } from 'lucide-react';
import type { Framework } from '@/lib/data-loader';

interface FrameworkTreeProps {
  framework: Framework;
  activeRequirementId?: string;
}

export default function FrameworkTree({ framework, activeRequirementId }: FrameworkTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    // 默认展开第一个分类
    if (framework.categories.length > 0) {
      return new Set([framework.categories[0].id]);
    }
    return new Set();
  });

  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setExpandedSubcategories(prev => {
      const next = new Set(prev);
      if (next.has(subcategoryId)) {
        next.delete(subcategoryId);
      } else {
        next.add(subcategoryId);
      }
      return next;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Framework Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900">{framework.name}</span>
          <span className="text-sm text-gray-500">({framework.categories.length} 分类)</span>
        </div>
      </div>

      {/* Tree */}
      <div className="py-2">
        {framework.categories.map((category) => {
          const categoryRequirementCount = category.subcategories.reduce(
            (sum, subcategory) => sum + subcategory.requirements.length,
            0
          );

          return (
            <div key={category.id}>
              {/* Category */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center px-4 py-2 hover:bg-gray-50 transition-colors text-left"
              >
                {expandedCategories.has(category.id) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                )}
                <FileText className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900 mr-2">{category.code}</span>
                    <span className="text-sm text-gray-700 truncate">{category.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {category.subcategories.length} 子分类, {categoryRequirementCount} 要求
                  </div>
                </div>
              </button>

              {/* Subcategories */}
              {expandedCategories.has(category.id) && (
                <div className="ml-4 border-l border-gray-200">
                  {category.subcategories.map((subcategory) => (
                    <div key={subcategory.id}>
                      {/* Subcategory */}
                      <button
                        onClick={() => toggleSubcategory(subcategory.id)}
                        className="w-full flex items-center px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                      >
                        {expandedSubcategories.has(subcategory.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        )}
                        <Lock className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-700 mr-2">{subcategory.code}</span>
                            <span className="text-sm text-gray-600 truncate">{subcategory.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {subcategory.requirements.length} 要求
                          </div>
                        </div>
                      </button>

                      {/* Requirements */}
                      {expandedSubcategories.has(subcategory.id) && (
                        <div className="ml-8">
                          {subcategory.requirements.map((requirement) => (
                            <Link
                              key={requirement.id}
                              href={`/frameworks/${framework.id}/requirements/${requirement.id}`}
                              className={`block px-4 py-2 hover:bg-blue-50 transition-colors ${
                                activeRequirementId === requirement.id
                                  ? 'bg-blue-50 border-l-2 border-blue-500'
                                  : ''
                              }`}
                            >
                              <div className="flex items-start">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-800">
                                    {requirement.code}
                                  </div>
                                  <div className="text-xs text-gray-600 truncate">
                                    {requirement.name}
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
