import type { PlanUnit } from "./read.js";

export type OrderInput = Pick<PlanUnit, "number" | "files" | "dependsOn" | "blocked">;

export interface UnitOrder {
  batches: number[][];
  waits: { unit: number; reason: string }[];
  setAside: { unit: number; reason: string }[];
  committed: number[];
}

export type OrderResult = { ok: true; order: UnitOrder } | { ok: false; cycle: number[] };

const findCycle = (units: OrderInput[]): number[] | undefined => {
  const byNumber = new Map(units.map((u) => [u.number, u]));
  const done = new Set<number>();
  const path: number[] = [];
  const visit = (n: number): number[] | undefined => {
    const at = path.indexOf(n);
    if (at >= 0) return path.slice(at);
    if (done.has(n)) return undefined;
    path.push(n);
    for (const d of byNumber.get(n)?.dependsOn ?? []) {
      const found = visit(d);
      if (found) return found;
    }
    path.pop();
    done.add(n);
    return undefined;
  };
  for (const u of units) {
    const found = visit(u.number);
    if (found) return found;
  }
  return undefined;
};

/** Pure: reads no file and runs no git. `committed` holds the units that already have a commit. */
export const orderUnits = (units: OrderInput[], committed: ReadonlySet<number>): OrderResult => {
  const cycle = findCycle(units);
  if (cycle) return { ok: false, cycle };

  const sorted = [...units].sort((a, b) => a.number - b.number);
  const setAside: { unit: number; reason: string }[] = [];
  const asideNumbers = new Set<number>();
  for (const u of sorted) {
    if (!committed.has(u.number) && u.blocked !== undefined) {
      setAside.push({ unit: u.number, reason: `it is blocked: ${u.blocked}` });
      asideNumbers.add(u.number);
    }
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const u of sorted) {
      if (committed.has(u.number) || asideNumbers.has(u.number)) continue;
      const m = u.dependsOn.find((d) => asideNumbers.has(d));
      if (m !== undefined) {
        setAside.push({ unit: u.number, reason: `it depends on unit ${m}, which is set aside` });
        asideNumbers.add(u.number);
        changed = true;
      }
    }
  }
  setAside.sort((a, b) => a.unit - b.unit);

  const placed = new Set<number>(committed);
  const batches: number[][] = [];
  const lastReason = new Map<number, string>();
  let remaining = sorted.filter((u) => !committed.has(u.number) && !asideNumbers.has(u.number));
  while (remaining.length > 0) {
    const batch: OrderInput[] = [];
    const next: OrderInput[] = [];
    for (const u of remaining) {
      const missing = u.dependsOn.find((d) => !placed.has(d));
      if (missing !== undefined) {
        lastReason.set(u.number, `it depends on unit ${missing}`);
        next.push(u);
        continue;
      }
      const mine = u.files.map((f) => f.toLowerCase());
      const clash = batch.find((b) => b.files.some((f) => mine.includes(f.toLowerCase())));
      if (clash) {
        const theirs = clash.files.map((f) => f.toLowerCase());
        const shared = u.files.filter((f) => theirs.includes(f.toLowerCase()));
        lastReason.set(u.number, `it shares ${shared.map((f) => `\`${f}\``).join(", ")} with unit ${clash.number}`);
        next.push(u);
        continue;
      }
      batch.push(u);
    }
    if (batch.length === 0) break;
    for (const u of batch) placed.add(u.number);
    batches.push(batch.map((u) => u.number));
    remaining = next;
  }

  const waits = batches
    .slice(1)
    .flat()
    .sort((a, b) => a - b)
    .map((unit) => ({ unit, reason: lastReason.get(unit) ?? "" }));
  const committedList = sorted.filter((u) => committed.has(u.number)).map((u) => u.number);
  return { ok: true, order: { batches, waits, setAside, committed: committedList } };
};
