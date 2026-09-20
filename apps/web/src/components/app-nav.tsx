"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons = {
  overview: <path d="M3.5 9.2 10 3.5l6.5 5.7V16a.5.5 0 0 1-.5.5h-3.5v-4.2h-5v4.2H4a.5.5 0 0 1-.5-.5V9.2Z" />,
  analysis: <path d="M3 16.5h14M5.5 13.5V9.5M9 13.5V5.5M12.5 13.5V8M16 13.5V3.5" />,
  generate: <path d="M10 3v14M3 10h14M5 5l10 10M15 5 5 15" />,
  bets: <path d="M4.5 3.5h11v13l-2.2-1.6-2.1 1.6-2.2-1.6-2.3 1.6-2.2-1.6V3.5ZM7.5 8h5M7.5 11h3.5" />,
  results: <><rect x="3" y="3.5" width="14" height="13" rx="2" /><path d="M3 7.5h14M7 11h1.5M11.5 11H13M7 13.5h1.5" /></>,
};

const links = [
  { href: "/app", label: "Visão geral", short: "Início", icon: icons.overview },
  { href: "/app/analises", label: "Análises", short: "Análises", icon: icons.analysis },
  { href: "/app/gerador", label: "Gerar jogos", short: "Gerar", icon: icons.generate, primary: true },
  { href: "/app/apostas", label: "Minhas apostas", short: "Apostas", icon: icons.bets },
  { href: "/app/resultados", label: "Resultados", short: "Resultados", icon: icons.results },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/app" ? pathname === href : pathname.startsWith(href));
}

function Icon({ children }: { children: React.ReactNode }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

/** Navegação lateral (desktop). */
export function AppNav() {
  const isActive = useActive();

  return (
    <nav className="side-nav" aria-label="Navegação da plataforma">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link className={active ? "active" : ""} href={link.href} key={link.href} aria-current={active ? "page" : undefined}>
            <Icon>{link.icon}</Icon>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra de abas inferior (celular): de ponta a ponta, respeita a área segura do iPhone. */
export function TabBar() {
  const isActive = useActive();

  return (
    <nav className="tab-bar" aria-label="Navegação principal">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link className={`${active ? "active" : ""} ${link.primary ? "primary" : ""}`} href={link.href} key={link.href} aria-current={active ? "page" : undefined} aria-label={link.label}>
            <span className="tab-icon"><Icon>{link.icon}</Icon></span>
            <span className="tab-label">{link.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
