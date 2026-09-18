import type { Metadata } from "next";
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexo | Decisões mais claras para seus jogos",
    template: "%s | Nexo",
  },
  description:
    "Organize jogos, compare resultados e explore dados históricos com clareza e responsabilidade.",
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
