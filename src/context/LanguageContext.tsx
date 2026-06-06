import { createContext, useState, useEffect } from "react"
import { translations } from "@/i18n"

type Lang = "en" | "ar"
const LANGUAGE_KEY = "app_language"

type ContextType = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string) => string
}

export const LanguageContext = createContext<ContextType | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")

  // Load saved language
  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY)
    if (saved === "ar" || saved === "en") {
      setLangState(saved)
    }
  }, [])

  // Sync DOM (RTL + lang)
  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem(LANGUAGE_KEY, l)
  }

  const t = (key: string) => {
    return translations[lang]?.[key as keyof typeof translations["en"]] || key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
