import { useSettingsStore } from '../store/useSettingsStore';
import { translations, Language } from './translations';

export const useTranslation = () => {
  const language = useSettingsStore((state) => (state.settings?.language as Language) || 'en');
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const t = (key: string, fallback?: string): string => {
    const currentLang = language === 'hi' ? 'hi' : 'en';
    if (translations[currentLang] && translations[currentLang][key]) {
      return translations[currentLang][key];
    }
    if (translations['en'] && translations['en'][key]) {
      return translations['en'][key];
    }
    return fallback || key;
  };

  const setLanguage = (newLang: Language) => {
    updateSettings({ language: newLang });
  };

  return { t, language, setLanguage };
};
