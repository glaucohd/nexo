import type { MetadataRoute } from "next";

// Manifesto do app instalável (PWA): nome, ícones e abertura em tela cheia.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexo",
    short_name: "Nexo",
    description: "Gere, analise e confira jogos das loterias.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0e15",
    theme_color: "#0f0e15",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
