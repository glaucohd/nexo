"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = { open: boolean; onClose: () => void; label: string; children: React.ReactNode };

/** Folha que sobe de baixo (celular): fundo escurecido, Esc e toque fora fecham, rolagem da página travada. */
export function BottomSheet({ open, onClose, label, children }: Props) {
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  // No <body>: fora dos contextos de empilhamento do conteúdo, a folha fica acima da barra de abas e do topo.
  return createPortal(
    <div className="sheet-root">
      <button type="button" className="sheet-backdrop" aria-label="Fechar" tabIndex={-1} onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={sheet}>
        <span className="sheet-grip" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
