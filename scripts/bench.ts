// Mide latencias (p50/p95) de los endpoints analíticos contra una API en marcha.
// Uso: INTERNAL_API_TOKEN=... bun scripts/bench.ts [baseUrl] [requestsPorEndpoint]
// El token interno evita que el rate limit corte la medición.
export {};

const base = process.argv[2] ?? "http://localhost:8080";
const n = Number(process.argv[3] ?? 200);
const headers: Record<string, string> = process.env.INTERNAL_API_TOKEN
  ? { "X-Internal-Token": process.env.INTERNAL_API_TOKEN }
  : {};

const endpoints = [
  "/api/v1/kpis",
  "/api/v1/kpis?category=Clothing&season=Winter",
  "/api/v1/kpis?state=TX&paymentMethod=Cash",
  "/api/v1/sales/by-category",
  "/api/v1/sales/by-season",
  "/api/v1/products/ranking?gender=Female",
  "/api/v1/customers/segments",
  "/api/v1/customers/demographics",
  "/api/v1/geo/states?ageBand=25-34",
  "/api/v1/purchases?page=10&pageSize=50&sort=amountUsd:desc&q=a",
];

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;

console.log(`${n} solicitudes secuenciales por endpoint contra ${base}\n`);
console.log("p50 (ms)  p95 (ms)  endpoint");
let worst = 0;
for (const path of endpoints) {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    const res = await fetch(base + path, { headers });
    await res.arrayBuffer();
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const p95 = percentile(times, 95);
  worst = Math.max(worst, p95);
  console.log(
    `${percentile(times, 50).toFixed(1).padStart(8)}  ${p95.toFixed(1).padStart(8)}  ${path}`,
  );
}
console.log(
  `\np95 máximo: ${worst.toFixed(1)} ms ${worst < 100 ? "(cumple RNF-02 < 100 ms)" : "(NO cumple RNF-02)"}`,
);
