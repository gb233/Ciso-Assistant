'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Framework, FrameworkMeta } from '@/lib/data-loader';
import { useLanguage } from './LanguageProvider';

interface FrameworkSelectorProps {
  currentFramework: Framework;
  allFrameworks: FrameworkMeta[];
  variant?: 'default' | 'sidebar-dark';
}

export default function FrameworkSelector({
  currentFramework,
  allFrameworks,
  variant = 'default'
}: FrameworkSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguage();
  const isZh = language === 'zh';
  const isSidebarDark = variant === 'sidebar-dark';

  const triggerClassName = isSidebarDark
    ? 'w-full flex items-center justify-between gap-2 cursor-pointer px-2 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-colors'
    : 'w-full flex items-center justify-between gap-2 cursor-pointer hover:bg-cyan-50 transition-colors px-2 py-1.5 rounded-lg border border-slate-200 bg-white';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={triggerClassName}
      >
        <span className={`font-semibold text-sm truncate text-left ${isSidebarDark ? 'text-white' : 'text-slate-900'}`}>
          {currentFramework.name}
        </span>
        <svg
          className={`w-4 h-4 ${isSidebarDark ? 'text-slate-300' : 'text-slate-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 bg-cyan-50/45 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{isZh ? '选择框架' : 'Select Framework'}</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <svg
                  className="w-5 h-5 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-2 overflow-y-auto max-h-[60vh]">
              <div className="space-y-1">
                {allFrameworks.map((fw) => {
                  const isCurrent = fw.id === currentFramework.id;

                  return (
                    <Link
                      key={fw.id}
                      href={`/frameworks/${fw.id}`}
                      className={`w-full block px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                        isCurrent
                          ? 'bg-cyan-50 text-cyan-800 font-semibold'
                          : 'text-slate-700 hover:bg-cyan-50'
                      }`}
                      onClick={() => setIsOpen(false)}
                      title={fw.name}
                    >
                      {fw.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
