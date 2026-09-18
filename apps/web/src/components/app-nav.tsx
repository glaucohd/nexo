"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons = {
  overview: <><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></>,
  analysis: <path d="M3 16.5h14M5.5 13.5V9.5M9 13.5V5.5M12.5 13.5V8M16 13.5V3.5" />,
  generate: <><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="13.5" r="2.5" /><circle cx="13.5" cy="13.5" r="2.5" fill="currentColor" /></>,
  bets: <path d="M4.5 3.5h11v13l-2.2-1.6-2.1 1.6-2.2-1.6-2.3 1.6-2.2-1.6V3.5ZM7.5 8h5M7.5 11h3.5" />,
  results: <><rect x="3" y="3.5" width="14" height="13" rx="2" /><path d="M3 7.5h14M7 11h1.5M11.5 11H13M7 13.5h1.5" /></>,
};

const links = [
  { href: "/app", label: "Visão geral", icon: icons.overview },
  { href: "/app/analises", label: "Análises", icon: icons.analysis },
  { href: "/app/gerador", label: "Gerar jogos", icon: icons.generate },
  { href: "/app/apostas", label: "Minhas apostas", icon: icons.bets },
  { href: "/app/resultados", label: "Resultados", icon: icons.results },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação da plataforma">
      {links.map((link) => {
        const active =
          link.href === "/app"
            ? pathname === link.href
            : pathname.startsWith(link.href);

        return (
          <Link className={active ? "active" : ""} href={link.href} key={link.href} aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{link.icon}</svg>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
