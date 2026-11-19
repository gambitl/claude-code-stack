import { describe, expect, it } from "vitest";
import { orderUnits, type OrderInput } from "../../src/plan/order.js";

const u = (number: number, files: string[], dependsOn: number[] = [], blocked?: string): OrderInput => ({
  number,
  files,
  dependsOn,
  ...(blocked === undefined ? {} : { blocked }),
});

const order = (units: OrderInput[], committed: number[] = []) => {
  const r = orderUnits(units, new Set(committed));
  if (!r.ok) throw new Error("cycle");
  return r.order;
};

describe("orderUnits", () => {
  it("puts units that share a file in different batches", () => {
    const o = order([u(1, ["src/a.ts"]), u(2, ["src/a.ts"]), u(3, ["src/b.ts"])]);
    expect(o.batches).toEqual([[1, 3], [2]]);
    expect(o.waits).toEqual([{ unit: 2, reason: "it shares `src/a.ts` with unit 1" }]);
  });

  it("puts a unit after the unit it depends on", () => {
    const o = order([u(1, ["a"]), u(2, ["b"], [1])]);
    expect(o.batches).toEqual([[1], [2]]);
    expect(o.waits).toEqual([{ unit: 2, reason: "it depends on unit 1" }]);
  });

  it("leaves committed units out and lets their dependents start", () => {
    const o = order([u(1, ["a"]), u(2, ["b"], [1])], [1]);
    expect(o.batches).toEqual([[2]]);
    expect(o.committed).toEqual([1]);
    expect(o.waits).toEqual([]);
  });

  it("sets aside blocked units and the units that depend on them", () => {
    const o = order([u(1, ["a"], [], "waiting"), u(2, ["b"], [1]), u(3, ["c"], [2]), u(4, ["d"])]);
    expect(o.batches).toEqual([[4]]);
    expect(o.setAside).toEqual([
      { unit: 1, reason: "it is blocked: waiting" },
      { unit: 2, reason: "it depends on unit 1, which is set aside" },
      { unit: 3, reason: "it depends on unit 2, which is set aside" },
    ]);
  });

  it("reports a cycle, also among committed units", () => {
    const units = [u(1, ["a"], [2]), u(2, ["b"], [1])];
    expect(orderUnits(units, new Set())).toEqual({ ok: false, cycle: [1, 2] });
    expect(orderUnits(units, new Set([1, 2]))).toEqual({ ok: false, cycle: [1, 2] });
  });

  it("compares files without case and names every shared file", () => {
    const o = order([u(1, ["src/A.ts", "src/x.ts"]), u(2, ["src/a.ts", "src/X.ts"])]);
    expect(o.batches).toEqual([[1], [2]]);
    expect(o.waits[0]?.reason).toBe("it shares `src/a.ts`, `src/X.ts` with unit 1");
  });
});
