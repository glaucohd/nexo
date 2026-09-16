import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Nexo, página inicial">
      <span className="brand-mark" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <i className={[0, 2, 4, 6, 8].includes(index) ? "picked" : ""} key={index} />
        ))}
      </span>
      {!compact && <span className="brand-name">nexo</span>}
    </Link>
  );
}
