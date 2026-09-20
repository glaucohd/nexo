"use client";

import { useCallback, useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";

type Props = { initials: string; name: string; email: string; children: React.ReactNode };

/** Menu da conta no celular: o avatar do topo abre uma folha de baixo com tema, atualização da base e sair. */
export function AccountSheet({ initials, name, email, children }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="avatar-button" aria-label="Abrir menu da conta" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        {initials || "?"}
      </button>
      <BottomSheet open={open} onClose={close} label="Conta">
        <div className="sheet-user">
          <span className="avatar-large" aria-hidden="true">{initials || "?"}</span>
          <div>
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </BottomSheet>
    </>
  );
}
