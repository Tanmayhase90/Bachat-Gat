import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../locales/translations';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'bachat_gat_language';
const DEFAULT_GROUP_NAME_EN = 'Chhatrapati Bachat Gat, Ghargaon Stand';
const DEFAULT_GROUP_NAME_MR = 'छत्रपती बचत गट, घारगाव स्टँड';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'mr' ? 'mr' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = useCallback((lang) => {
    const validLang = lang === 'mr' ? 'mr' : 'en';
    setLanguageState(validLang);
    try {
      localStorage.setItem(STORAGE_KEY, validLang);
    } catch (err) {
      console.warn('Failed to save language preference:', err);
    }
  }, []);

  /**
   * Safe Translation Lookup (with dot-notation key resolution and parameter interpolation)
   * Example: t('dashboard.title') -> "Financial Overview" or "आर्थिक आढावा"
   * Example: t('common.months.8') -> "August" or "ऑगस्ट"
   */
  const t = useCallback(
    (key, paramsOrFallback = {}) => {
      if (!key) return '';

      const fallback = typeof paramsOrFallback === 'string' ? paramsOrFallback : undefined;
      const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : {};

      const resolveKey = (dict, path) => {
        if (!dict) return undefined;
        const keys = path.split('.');
        let current = dict;
        for (const k of keys) {
          if (current === undefined || current === null) return undefined;
          current = current[k];
        }
        return current;
      };

      // 1. Try selected language
      let text = resolveKey(translations[language], key);

      // 2. Fallback to English
      if (text === undefined && language !== 'en') {
        text = resolveKey(translations.en, key);
      }

      // 3. Fallback to passed fallback string or key
      if (text === undefined) {
        text = fallback !== undefined ? fallback : key;
      }

      if (typeof text !== 'string') return text;

      // Interpolate {param} placeholders if provided
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }

      return text;
    },
    [language]
  );

  /**
   * Localized Group Name Helper
   */
  const getGroupName = useCallback(
    (groupName) => {
      if (!groupName || groupName === DEFAULT_GROUP_NAME_EN || groupName === DEFAULT_GROUP_NAME_MR) {
        return language === 'mr' ? DEFAULT_GROUP_NAME_MR : DEFAULT_GROUP_NAME_EN;
      }
      return groupName;
    },
    [language]
  );

  const value = {
    language,
    setLanguage,
    isMarathi: language === 'mr',
    isEnglish: language === 'en',
    currentLanguageLabel: language === 'mr' ? 'मराठी' : 'English',
    t,
    getGroupName,
    translations: translations[language] || translations.en,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if used outside Provider
    return {
      language: 'en',
      setLanguage: () => {},
      isMarathi: false,
      isEnglish: true,
      currentLanguageLabel: 'English',
      t: (k, fb) => (typeof fb === 'string' ? fb : k),
      getGroupName: (g) => g || DEFAULT_GROUP_NAME_EN,
      translations: translations.en,
    };
  }
  return context;
};

export default LanguageContext;
