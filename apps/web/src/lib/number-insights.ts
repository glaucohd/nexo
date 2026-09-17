export type InsightDraw = { numbers: number[] };

export type NumberInsight = {
  number: number;
  frequency: number;
  recent: number;
  delay: number;
};

export function numberInsights(history: readonly InsightDraw[], total: number, recentWindow = 30, start = 1): NumberInsight[] {
  const recent = history.slice(0, recentWindow);
  return Array.from({ length: total }, (_, index) => {
    const number = index + start;
    const delay = history.findIndex((draw) => draw.numbers.includes(number));
    return {
      number,
      frequency: history.filter((draw) => draw.numbers.includes(number)).length,
      recent: recent.filter((draw) => draw.numbers.includes(number)).length,
      delay: delay < 0 ? history.length : delay,
    };
  });
}
