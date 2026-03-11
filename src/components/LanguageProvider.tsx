'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Language, Translations } from '@/lib/i18n';
import {
  translations,
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  storeLanguage,
  LANGUAGE_COOKIE_KEY
} from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: Translations;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isReady, setIsReady] = useState(false);

  // Load language from localStorage on mount
  useEffect(() => {
    const stored = getStoredLanguage();
    setLanguageState(stored);
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${stored}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = stored;
    setIsReady(true);
  }, []);

  // Set language and save to localStorage
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    storeLanguage(lang);
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${lang}; path=/; max-age=31536000; samesite=lax`;
    // Update HTML lang attribute
    document.documentElement.lang = lang;
  }, []);

  // Toggle between zh and en
  const toggleLanguage = useCallback(() => {
    const newLang = language === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
  }, [language, setLanguage]);

  // Get translations for current language
  const t = translations[language];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        isReady,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// Hook to use language context
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
