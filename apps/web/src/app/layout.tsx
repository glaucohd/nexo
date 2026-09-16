import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexo | Decisões mais claras para seus jogos",
    template: "%s | Nexo",
  },
  description:
    "Organize jogos, compare resultados e explore dados históricos com clareza e responsabilidade.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
