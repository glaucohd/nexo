export type AnalysisDraw = {
  contest: number;
  date: string;
  numbers: number[];
};

export type Metric = {
  label: string;
  values: number[];
};

const primeNumbers = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]);

function fibonacciNumbers(limit: number) {
  const values = new Set<number>([1, 2]);
  let previous = 1;
  let current = 2;
  while (previous + current <= limit) {
    const next = previous + current;
    values.add(next);
    previous = current;
    current = next;
  }
  return values;
}

export function countRepeated(current: number[], previous: number[]) {
  const previousNumbers = new Set(previous);
  return current.filter((number) => previousNumbers.has(number)).length;
}

export function analyzeDraws(draws: AnalysisDraw[], totalNumbers: number, limit: number) {
  const sample = draws.slice(0, limit);
  const frequencies = Array.from({ length: totalNumbers + 1 }, () => 0);
  const delays = Array.from({ length: totalNumbers + 1 }, () => draws.length);
  const repeats: number[] = [];

  for (const draw of sample) {
    for (const number of draw.numbers) frequencies[number] += 1;
  }
  for (let index = 0; index < draws.length; index += 1) {
    for (const number of draws[index].numbers) {
      if (delays[number] === draws.length) delays[number] = index;
    }
  }
  for (let index = 0; index < sample.length; index += 1) {
    if (draws[index + 1]) repeats.push(countRepeated(draws[index].numbers, draws[index + 1].numbers));
  }

  const repeatMean = repeats.length ? repeats.reduce((sum, value) => sum + value, 0) / repeats.length : null;
  return { sample, frequencies, delays, repeats, repeatMean };
}

export function recentMetrics(draws: AnalysisDraw[], totalNumbers: number, sampleSize = 15): Metric[] {
  const sample = draws.slice(0, sampleSize);
  const fibonacci = fibonacciNumbers(totalNumbers);
  const metrics: Metric[] = [
    { label: "Repetidas do anterior", values: sample.flatMap((draw, index) => draws[index + 1] ? [countRepeated(draw.numbers, draws[index + 1].numbers)] : []) },
    { label: "Pares", values: sample.map((draw) => draw.numbers.filter((number) => number % 2 === 0).length) },
    { label: "Ímpares", values: sample.map((draw) => draw.numbers.filter((number) => number % 2 !== 0).length) },
    { label: "Primos", values: sample.map((draw) => draw.numbers.filter((number) => primeNumbers.has(number)).length) },
    { label: "Fibonacci", values: sample.map((draw) => draw.numbers.filter((number) => fibonacci.has(number)).length) },
  ];

  if (totalNumbers === 25) {
    metrics.push({
      label: "Moldura",
      values: sample.map((draw) => draw.numbers.filter((number) => {
        const row = Math.floor((number - 1) / 5);
        const column = (number - 1) % 5;
        return row === 0 || row === 4 || column === 0 || column === 4;
      }).length),
    });
  }
  return metrics;
}

export function metricDistribution(values: number[]) {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
}

export function analyzeCycles(drawsNewestFirst: AnalysisDraw[], totalNumbers: number, mode: "presence" | "absence", start = 1) {
  const universe = Array.from({ length: totalNumbers }, (_, index) => index + start);
  const seen = new Set<number>();
  const byContest = new Map<number, { cycle: number; closed: boolean; coverage: number }>();
  let completed = 0;
  let startContest: number | null = null;

  for (const draw of [...drawsNewestFirst].reverse()) {
    if (startContest === null) startContest = draw.contest;
    const selected = new Set(draw.numbers);
    const observed = mode === "presence" ? draw.numbers : universe.filter((number) => !selected.has(number));
    for (const number of observed) seen.add(number);
    const closed = seen.size === totalNumbers;
    byContest.set(draw.contest, { cycle: completed + 1, closed, coverage: seen.size });
    if (closed) {
      completed += 1;
      seen.clear();
      startContest = null;
    }
  }

  return {
    completed,
    openCoverage: seen.size,
    startContest,
    missing: universe.filter((number) => !seen.has(number)),
    byContest,
  };
}
