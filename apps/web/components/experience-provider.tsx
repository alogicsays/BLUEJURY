"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, languageNames, locales, translate, type Locale, type TranslationKey } from "@/lib/i18n";
import { legacyDisplayName, LEGACY_PROFILE_KEY, registerLocalAccount, restoreLocalSession, signInLocalAccount, signOutLocalAccount, updateLocalDisplayName, type LocalUser } from "@/lib/local-auth";

const LANGUAGE_KEY = "bluejury-language-v1";

type ExperienceContextValue = {
  ready: boolean;
  profile: LocalUser | null;
  legacyName: string;
  locale: Locale;
  languages: typeof languageNames;
  setLocale: (locale: Locale) => void;
  saveProfile: (displayName: string) => void;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatDate: (value: string | number | Date) => string;
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);
const fallbackExperience: ExperienceContextValue = {
  ready: true, profile: { id: "fallback", displayName: "Fisher", email: "" }, legacyName: "", locale: "en", languages: languageNames,
  setLocale: () => undefined, saveProfile: () => undefined, register: async () => undefined, signIn: async () => undefined, signOut: () => undefined,
  t: (key, values) => translate("en", key, values),
  formatDate: value => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)),
};

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<LocalUser | null>(null);
  const [legacyName, setLegacyName] = useState("");
  const [locale, setLocaleState] = useState<Locale>("en");

  // Restore browser-only preferences after hydration; no storage is touched during SSR.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storedLocale = localStorage.getItem(LANGUAGE_KEY);
    if (storedLocale && locales.includes(storedLocale as Locale)) setLocaleState(storedLocale as Locale);
    setProfile(restoreLocalSession());
    setLegacyName(legacyDisplayName());
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LANGUAGE_KEY, next);
  }, []);
  const saveProfile = useCallback((displayName: string) => {
    if (!profile || !displayName.trim()) return;
    const updated = updateLocalDisplayName(profile.id, displayName);
    if (updated) setProfile(updated);
  }, [profile]);
  const register = useCallback(async (displayName: string, email: string, password: string) => {
    const user = await registerLocalAccount(displayName, email, password);
    setProfile(user);
    setLegacyName("");
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    setProfile(await signInLocalAccount(email, password));
  }, []);
  const signOut = useCallback(() => {
    signOutLocalAccount();
    setProfile(null);
  }, []);
  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => translate(locale, key, values), [locale]);
  const formatDate = useCallback((value: string | number | Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)), [locale]);
  const value = useMemo(() => ({ ready, profile, legacyName, locale, languages: languageNames, setLocale, saveProfile, register, signIn, signOut, t, formatDate }), [ready, profile, legacyName, locale, setLocale, saveProfile, register, signIn, signOut, t, formatDate]);
  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience() {
  const value = useContext(ExperienceContext);
  return value ?? fallbackExperience;
}

export { dictionaries, LEGACY_PROFILE_KEY as PROFILE_KEY, LANGUAGE_KEY };
