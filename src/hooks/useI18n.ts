import { create } from "zustand";
import en from "@/locales/en.json";

export type Language = "en" | "es" | "fr" | "de" | "zh" | "ar";

interface I18nStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultValue?: string) => string;
}

const translations: Record<Language, typeof en> = {
  en,
  es: en,
  fr: en,
  de: en,
  zh: en,
  ar: en,
};

export const useI18n = create<I18nStore>((set, get) => ({
  language: "en",
  setLanguage: (language) => set({ language }),
  t: (key: string, defaultValue?: string) => {
    const { language } = get();
    const trans = translations[language];
    
    const keys = key.split(".");
    let value: any = trans;
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || defaultValue || key;
  },
}));

export function useTranslate() {
  const language = useI18n((s) => s.language);
  const t = useI18n((s) => s.t);
  return { language, t };
}
