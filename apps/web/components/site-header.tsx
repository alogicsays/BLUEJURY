"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "./brand-mark";
import { useBluejury } from "./app-provider";
import { useExperience } from "./experience-provider";
import type { Locale, TranslationKey } from "@/lib/i18n";

const links: Array<[TranslationKey, string]> = [["plan", "/plan"], ["marineMap", "/map"], ["liveTrip", "/trip"], ["aboutData", "/about-data"]];

export function SiteHeader() {
  const path = usePathname();
  const { networkStatus, savedTrip, runAnalysis } = useBluejury();
  const { profile, locale, languages, setLocale, saveProfile, signOut, t, formatDate } = useExperience();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftName, setDraftName] = useState(profile?.displayName ?? "");
  const offline = networkStatus.startsWith("OFFLINE");
  const noCache = networkStatus === "OFFLINE_NO_CACHE";
  const save = () => { saveProfile(draftName); setSettingsOpen(false); };
  const openSettings = () => { setDraftName(profile?.displayName ?? ""); setSettingsOpen(true); };
  return <>
    <header className="site-header"><nav aria-label="Primary" className="nav-inner">
      <Link href="/" className="brand"><BrandMark className="brand-mark" /><span>BLUEJURY <em>AI</em></span></Link>
      <div className="nav-links">{links.map(([key, href]) => <Link key={href} href={href} className={path === href || path.startsWith(`${href}/`) ? "active" : ""}>{t(key)}</Link>)}</div>
      <span className={`evidence-dot ${offline ? "offline" : ""}`}><i /> {offline ? t("offlineMode") : networkStatus === "CONNECTION_RESTORED" ? t("connectionRestored") : t("evidenceConnected")}</span>
      <button className="profile-trigger" aria-label={t("settings")} onClick={openSettings}><span>{profile?.displayName.slice(0, 1).toUpperCase()}</span><b>{profile?.displayName}</b></button>
    </nav></header>
    {offline && <div className="network-banner" role="status"><b>{t("offlineModeUpper")}</b><span>{noCache ? t("offlineNoCacheBanner") : t("usingSavedEvidence", { time: savedTrip ? formatDate(savedTrip.savedAt) : "—" })}</span></div>}
    {networkStatus === "CONNECTION_RESTORED" && <div className="network-banner restored" role="status"><b>{t("connectionRestored").toUpperCase()}</b><span>{t("savedDecisionUnchanged")}</span><button onClick={() => void runAnalysis()}>{t("refreshEvidence")}</button></div>}
    {settingsOpen && <div className="settings-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header><div><p className="eyebrow">{t("profile")}</p><h2 id="settings-title">{t("settings")}</h2></div><button aria-label={t("close")} onClick={() => setSettingsOpen(false)}>×</button></header>
      <label>{t("savedName")}<input maxLength={60} value={draftName} onChange={event => setDraftName(event.target.value)} /></label>
      {profile?.email && <p className="settings-account">{t("signedInAs", { email: profile.email })}</p>}
      <label>{t("language")}<select value={locale} onChange={event => setLocale(event.target.value as Locale)}>{Object.entries(languages).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      <button className="button primary" disabled={!draftName.trim()} onClick={save}>{t("saveChanges")}</button>
      <div className="settings-signout"><button onClick={() => { setSettingsOpen(false); signOut(); }}>{t("signOut")}</button><p>{t("signOutNote")}</p></div>
    </section></div>}
  </>;
}
