'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from './LanguageProvider';
import { Check, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LanguageSwitcherProps {
  variant?: 'button' | 'dropdown' | 'minimal';
  className?: string;
}

export default function LanguageSwitcher({ variant = 'button', className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const switchTo = (target: 'zh' | 'en') => {
    if (target === language) return;
    setLanguage(target);
    router.refresh();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const renderSegmentedControl = (extraClassName = '') => (
    <div
      className={`inline-flex items-center rounded-xl border border-slate-300 bg-white/95 p-0.5 shadow-sm shadow-slate-200/60 ${extraClassName}`}
      role="group"
      aria-label={t.language.switchTo}
    >
      <button
        type="button"
        onClick={() => switchTo('zh')}
        aria-pressed={language === 'zh'}
        className={`rounded-lg transition-all ${
          variant === 'minimal' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        } ${
          language === 'zh'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title={`${t.language.switchTo} 中文`}
      >
        {variant === 'minimal' ? '中' : '中文'}
      </button>
      <button
        type="button"
        onClick={() => switchTo('en')}
        aria-pressed={language === 'en'}
        className={`rounded-lg transition-all ${
          variant === 'minimal' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        } ${
          language === 'en'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
        title={`${t.language.switchTo} English`}
      >
        {variant === 'minimal' ? 'EN' : 'English'}
      </button>
    </div>
  );

  if (variant === 'minimal') {
    return renderSegmentedControl(className);
  }

  if (variant === 'dropdown') {
    return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm shadow-slate-200/60 transition-colors hover:bg-slate-50"
          aria-expanded={isOpen}
          aria-haspopup="menu"
          title={`${t.language.switchTo} ${language === 'zh' ? 'English' : '中文'}`}
        >
          <Globe className="h-4 w-4 text-slate-500" />
          <span className="font-medium">{t.language[language]}</span>
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          className={`absolute right-0 z-50 mt-2 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-200/70 transition-all ${
            isOpen ? 'visible opacity-100' : 'invisible opacity-0'
          }`}
          role="menu"
        >
          <button
            type="button"
            onClick={() => switchTo('zh')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-slate-100 ${
              language === 'zh' ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'
            }`}
            role="menuitem"
          >
            中文
            {language === 'zh' && <Check className="h-4 w-4 text-slate-700" />}
          </button>
          <button
            type="button"
            onClick={() => switchTo('en')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-slate-100 ${
              language === 'en' ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'
            }`}
            role="menuitem"
          >
            English
            {language === 'en' && <Check className="h-4 w-4 text-slate-700" />}
          </button>
        </div>
      </div>
    );
  }

  // Default button variant: icon + segmented control for stronger affordance.
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-500 shadow-sm shadow-slate-200/60"
        aria-hidden="true"
      >
        <Globe className="h-4 w-4" />
      </span>
      {renderSegmentedControl()}
    </div>
  );
}
