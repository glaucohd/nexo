import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexo | Decisões mais claras para seus jogos",
    template: "%s | Nexo",
  },
  description:
    "Organize jogos, compare resultados e explore dados históricos com clareza e responsabilidade.",
  applicationName: "Nexo",
  // No iPhone, "Adicionar à Tela de Início" abre em tela cheia; a barra de
  // status fica sobre o app (o CSS reserva o espaço com safe-area-inset).
  appleWebApp: { capable: true, title: "Nexo", statusBarStyle: "black-translucent" },
  // O Next gera só a tag padrão; versões antigas do iOS ainda leem esta.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Teclado virtual encolhe a página em vez de cobrir os campos (Android).
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16151d" },
  ],
};

// Aplica o tema salvo (ou o do sistema) antes da primeira pintura, para a
// página não piscar clara antes de virar escura.
const themeScript = `(function(){try{var t=localStorage.getItem("nexo-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
