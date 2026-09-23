import { concoursesPerOccurrence, type GuaranteeRow } from "@/lib/reduction-stats";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR");

export const everyLabel = (every: number) => Number.isFinite(every) ? `1 a cada ${integer.format(Math.max(2, Math.round(every)))} concursos` : "nunca";

export function PrizePotentialNote() {
  return <p className="prize-potential-note"><b>O prêmio máximo continua possível.</b> A estratégia organiza a cobertura, mas uma cartela pode levar o prêmio principal se coincidir com o resultado completo.</p>;
}

// Quadro "o que fica garantido": em texto simples, o que se compra e, linha a
// linha, quantas sorteadas precisam cair no grupo para cada garantia.
// Linha que garante o mesmo que a de baixo (com condição mais fácil) é
// redundante: "5 ou mais → quadra" já cobre "6 → quadra".
const essentialRows = (rows: GuaranteeRow[]) => rows.filter((row, index) => index === rows.length - 1 || row.hits > rows[index + 1].hits);

export function GuaranteeSummary({ pool, games, costCents, ticketSize, drawSize, total, draws = 1, rows, hitName, note }: {
  pool: number; games: number; costCents: number; ticketSize: number; drawSize: number; total: number; draws?: number;
  rows: GuaranteeRow[]; hitName: (hits: number) => string; note?: string;
}) {
  return <div className="guarantee-summary">
    <p>Você escolhe <b>{pool} dezenas</b>. O Nexo monta <b>{games} {games === 1 ? "jogo" : "jogos"} de {ticketSize} dezenas</b> ({money.format(costCents / 100)}).</p>
    <PrizePotentialNote />
    <table>
      <thead><tr><th>Se, das {drawSize} sorteadas{draws > 1 ? " (em um dos sorteios)" : ""}, estiverem no seu grupo…</th><th>pelo menos um jogo faz</th><th>isso acontece</th></tr></thead>
      <tbody>{essentialRows(rows).map((row) => <tr key={row.inPool}>
        <td>{row.inPool === drawSize ? `todas as ${drawSize}` : `${row.inPool} ou mais`}</td>
        <td><b>{hitName(row.hits)}</b></td>
        <td>~{everyLabel(concoursesPerOccurrence({ total, drawSize, pool, inPool: row.inPool, draws }))}</td>
      </tr>)}</tbody>
    </table>
    <p className="guarantee-summary-note">{note ?? "Garantia provada por força bruta. Quando a condição não acontece não há garantia, mas os jogos concorrem normalmente."}</p>
  </div>;
}
