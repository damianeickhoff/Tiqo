import type { MetadataRoute } from "next";
import { getMessages } from "@/lib/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getMessages();

  return {
    name: "Tiqo",
    short_name: "Tiqo",
    description: t.nav.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#0c0c0e",
    orientation: "portrait-primary",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: t.nav.newTicket, url: "/tickets/new" },
      { name: t.nav.myQueue, url: "/tickets?assignee=me" },
    ],
  };
}
