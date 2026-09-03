import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { AppProvider } from "@/components/app-provider";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: "BLUEJURY AI", template: "%s | BLUEJURY AI" },
  description: "Explainable marine decision intelligence for fishers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppProvider><SiteHeader /><main>{children}</main></AppProvider></body></html>;
}
