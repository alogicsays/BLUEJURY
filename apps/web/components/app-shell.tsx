"use client";

import { SiteHeader } from "./site-header";
import { WelcomeScreen } from "./welcome-screen";
import { useExperience } from "./experience-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, profile } = useExperience();
  if (!ready) return <div className="app-boot" aria-label="BLUEJURY"><span>BLUEJURY</span></div>;
  if (!profile) return <WelcomeScreen />;
  return <><SiteHeader /><main>{children}</main></>;
}
