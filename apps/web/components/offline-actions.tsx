"use client";
import { useState } from "react";
import { useBluejury } from "./app-provider";
import { useExperience } from "./experience-provider";

export function SaveOfflineTripButton({ compact = false }: { compact?: boolean }) {
  const { result, savedTrip, saveForOffline } = useBluejury();
  const { t, formatDate } = useExperience();
  const [message, setMessage] = useState("");
  const save = async () => {
    try { const saved = await saveForOffline(); setMessage(t("tripSaved", { time: formatDate(saved.savedAt) })); }
    catch { setMessage(t("tripSaveFailed")); }
  };
  if (!result) return null;
  const evidenceTime = result.evidence.map(item => new Date(item.valid_time).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return <div className={`offline-save ${compact ? "compact" : ""}`}><button className="button secondary" onClick={save}>{savedTrip ? t("updateOffline") : t("saveOffline")}</button>{message && <p role="status">{message}</p>}{savedTrip && !message && <p><b>{t("offlineReady")}</b> · {t("savedAt", { time: formatDate(savedTrip.savedAt) })}</p>}{evidenceTime && <small>{t("latestEvidenceValid", { time: formatDate(evidenceTime) })}</small>}</div>;
}
