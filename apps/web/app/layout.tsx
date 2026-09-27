import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { AppProvider } from "@/components/app-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { ExperienceProvider } from "@/components/experience-provider";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: { default: "BLUEJURY AI", template: "%s | BLUEJURY AI" },
  description: "Explainable marine decision intelligence for fishers.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "BLUEJURY", statusBarStyle: "black-translucent" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ExperienceProvider><AppProvider><ServiceWorkerRegistration /><AppShell>{children}</AppShell></AppProvider></ExperienceProvider></body></html>;
}
