import { cookies } from 'next/headers';
import type { Language } from './i18n';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY } from './i18n';

export function getServerLanguage(): Language {
  const cookieStore = cookies();
  const cookieValue = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value;
  if (cookieValue === 'zh' || cookieValue === 'en') {
    return cookieValue;
  }

  return DEFAULT_LANGUAGE;
}
