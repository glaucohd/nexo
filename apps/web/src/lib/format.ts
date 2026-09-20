const moneyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatMoney = (cents: number) => moneyFormat.format(cents / 100);
export const padNumber = (value: number) => String(value).padStart(2, "0");
export const formatDate = (iso: string) => { const [year, month, day] = iso.slice(0, 10).split("-"); return `${day}/${month}/${year}`; };
export const pluralize = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
