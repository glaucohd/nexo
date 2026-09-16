"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/app", label: "Visão geral", icon: "◈" },
  { href: "/app/analises", label: "Análises", icon: "∿" },
  { href: "/app/gerador", label: "Gerar jogos", icon: "✦" },
  { href: "/app/apostas", label: "Minhas apostas", icon: "✓" },
  { href: "/app/resultados", label: "Resultados", icon: "#" },
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
          <Link className={active ? "active" : ""} href={link.href} key={link.href}>
            <span aria-hidden="true">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
