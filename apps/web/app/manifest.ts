import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BLUEJURY AI — Marine Decision Intelligence",
    short_name: "BLUEJURY",
    description: "Explainable marine decision support for fishing trips.",
    start_url: "/trip",
    display: "standalone",
    background_color: "#f5f5ef",
    theme_color: "#082f3d",
    orientation: "any",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
