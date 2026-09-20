import Link from "next/link";

/** Marca do Nexo: cartela 4×4 com as dezenas marcadas formando um "N" (a bola âmbar é a sorteada). O fundo em gradiente vem do CSS (.brand-mark). */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <circle cx="12.5" cy="12.5" r="5.4" fill="#fff" />
        <circle cx="25.5" cy="12.5" r="2.1" fill="#fff" fillOpacity=".38" />
        <circle cx="38.5" cy="12.5" r="2.1" fill="#fff" fillOpacity=".38" />
        <circle cx="51.5" cy="12.5" r="5.4" fill="#f5b23c" />
        <circle cx="12.5" cy="25.5" r="5.4" fill="#fff" />
        <circle cx="25.5" cy="25.5" r="5.4" fill="#fff" />
        <circle cx="38.5" cy="25.5" r="2.1" fill="#fff" fillOpacity=".38" />
        <circle cx="51.5" cy="25.5" r="5.4" fill="#fff" />
        <circle cx="12.5" cy="38.5" r="5.4" fill="#fff" />
        <circle cx="25.5" cy="38.5" r="2.1" fill="#fff" fillOpacity=".38" />
        <circle cx="38.5" cy="38.5" r="5.4" fill="#fff" />
        <circle cx="51.5" cy="38.5" r="5.4" fill="#fff" />
        <circle cx="12.5" cy="51.5" r="5.4" fill="#fff" />
        <circle cx="25.5" cy="51.5" r="2.1" fill="#fff" fillOpacity=".38" />
        <circle cx="38.5" cy="51.5" r="2.1" fill="#fff" fillOpacity=".38" />
        <circle cx="51.5" cy="51.5" r="5.4" fill="#fff" />
      </svg>
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Nexo, página inicial">
      <BrandMark />
      {!compact && <span className="brand-name">nexo</span>}
    </Link>
  );
}
