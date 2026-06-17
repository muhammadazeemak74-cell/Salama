import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KitchenGuard",
    short_name: "KitchenGuard",
    description: "AI food-safety logging for UAE kitchens",
    // Staff land on the recording screen when launched from the home screen.
    start_url: "/record",
    display: "standalone",
    background_color: "#16a34a",
    theme_color: "#16a34a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
