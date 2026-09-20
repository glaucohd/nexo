"use client";

import { useCallback, useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";

export type PickerGame = { slug: string; name: string; color: string };

type Props = { games: readonly PickerGame[]; value: string; onChange: (slug: string) => void };

function Clover({ slug }: { slug: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno; dispensa o otimizador de imagens.
  return <img className="lotto-clover" src={`/trevos-loterias/${slug}.svg`} alt="" width={22} height={22} />;
}

/**
 * Seletor de modalidade, um só para gerador, análises e resultados.
 * Desktop: fileira de chips. Celular: um botão com a modalidade atual que abre uma folha com todas em grade,
 * em vez de uma fileira que rola para o lado e esconde opções.
 */
export function LotteryPicker({ games, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const current = games.find((game) => game.slug === value) ?? games[0];
  const style = (game: PickerGame) => ({ "--chip": game.color }) as React.CSSProperties;

  return (
    <>
      <nav className="lotto-chips" aria-label="Modalidade">
        {games.map((game) => (
          <button type="button" key={game.slug} aria-pressed={value === game.slug} className="lotto-chip" style={style(game)} onClick={() => onChange(game.slug)}>
            <Clover slug={game.slug} />
            {game.name}
          </button>
        ))}
      </nav>

      <button type="button" className="lotto-select" style={style(current)} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="lotto-select-icon"><Clover slug={current.slug} /></span>
        <span className="lotto-select-text">
          <small>Modalidade</small>
          <strong>{current.name}</strong>
        </span>
        <span className="lotto-select-action">Trocar</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
      </button>

      <BottomSheet open={open} onClose={close} label="Escolha a modalidade">
        <h2 className="sheet-title">Escolha a modalidade</h2>
        <div className="lotto-grid">
          {games.map((game) => (
            <button
              type="button"
              key={game.slug}
              className="lotto-tile"
              style={style(game)}
              aria-pressed={value === game.slug}
              onClick={() => { onChange(game.slug); close(); }}
            >
              <Clover slug={game.slug} />
              <span>{game.name}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
