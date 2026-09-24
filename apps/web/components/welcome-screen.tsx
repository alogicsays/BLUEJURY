"use client";

import { FormEvent, useState } from "react";
import { BrandMark } from "./brand-mark";
import { useExperience } from "./experience-provider";
import { LocalAuthError, type AuthErrorCode } from "@/lib/local-auth";
import type { Locale, TranslationKey } from "@/lib/i18n";

type Mode = "signin" | "signup";
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const validPassword = (value: string) => value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);
const errorKeys: Record<AuthErrorCode, TranslationKey> = {
  DUPLICATE_EMAIL: "duplicateEmail", INVALID_CREDENTIALS: "invalidCredentials", AUTH_UNAVAILABLE: "authUnavailable",
};

export function WelcomeScreen() {
  const { locale, languages, setLocale, legacyName, register, signIn, t } = useExperience();
  const [mode, setMode] = useState<Mode>(legacyName ? "signup" : "signin");
  const [name, setName] = useState(legacyName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const switchMode = (next: Mode) => { setMode(next); setError(null); setPassword(""); setConfirmation(""); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validEmail(email)) return setError("invalidEmail");
    if (mode === "signup" && (!name.trim() || !password || !confirmation)) return setError("requiredFields");
    if (mode === "signup" && !validPassword(password)) return setError("passwordRules");
    if (mode === "signup" && password !== confirmation) return setError("passwordsMismatch");
    if (mode === "signin" && !password) return setError("requiredFields");
    setBusy(true);
    try {
      if (mode === "signup") await register(name, email, password);
      else await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof LocalAuthError ? errorKeys[cause.code] : "authUnavailable");
    } finally { setBusy(false); }
  };

  return <main className="welcome-shell">
    <section className="welcome-panel" aria-labelledby="welcome-title">
      <div className="welcome-brand"><BrandMark /><span>BLUEJURY <em>AI</em></span></div>
      <div className="welcome-copy"><p className="eyebrow">{t("welcomeEyebrow")}</p><h1 id="welcome-title">{t("welcomeTitle")}</h1><p>{t("welcomeCopy")}</p></div>
      <div className="auth-tabs" role="tablist" aria-label={`${t("signIn")} / ${t("signUp")}`}>
        <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => switchMode("signin")}>{t("signIn")}</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>{t("signUp")}</button>
      </div>
      {legacyName && mode === "signup" && <p className="auth-migration" role="status">{t("migratedProfile")}</p>}
      <form onSubmit={submit} className="welcome-form auth-form" noValidate>
        {mode === "signup" && <label>{t("displayName")}<input autoFocus autoComplete="name" maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder={t("namePlaceholder")} /></label>}
        <label>{t("emailAddress")}<input autoFocus={mode === "signin"} autoComplete="email" inputMode="email" type="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>{t("password")}<span className="password-field"><input autoComplete={mode === "signin" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? t("hidePassword") : t("showPassword")} onClick={() => setShowPassword(value => !value)}>{showPassword ? t("hidePassword") : t("showPassword")}</button></span></label>
        {mode === "signup" && <label>{t("confirmPassword")}<input autoComplete="new-password" type={showPassword ? "text" : "password"} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>}
        <label>{t("language")}<select aria-label={t("language")} value={locale} onChange={event => setLocale(event.target.value as Locale)}>{Object.entries(languages).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        {mode === "signup" && <p className="auth-help">{t("passwordRules")}</p>}
        {error && <p className="auth-error" role="alert">{t(error)}</p>}
        <button className="button primary" disabled={busy}>{busy ? "…" : mode === "signup" ? t("createAccount") : t("signIn")} <span aria-hidden="true">→</span></button>
      </form>
      <button className="auth-switch" type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>{t(mode === "signin" ? "noAccount" : "haveAccount")}</button>
      <p className="welcome-note">{t("authLocalNote")} {t("forgotNoRecovery")}</p>
    </section>
    <aside className="welcome-sea" aria-hidden="true"><span>05</span><strong>{t("juryBeforeJourney")}</strong><i /></aside>
  </main>;
}
