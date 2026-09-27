"use client";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(error => {
      if (process.env.NODE_ENV === "development") console.error("[BLUEJURY service worker]", error);
    });
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
