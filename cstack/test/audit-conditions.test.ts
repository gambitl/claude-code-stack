import { describe, expect, it } from "vitest";
import type { PlanRead } from "../src/plan/read.js";

async function load() {
  return await import("../src/audit/conditions.js");
}

/** A hand-built plan: the Ticket section spans the lines of `ticket`, counted from 1. */
function planOf(
  ticket: { first: number; last: number },
  units: { designSpecification?: string }[] = [],
): PlanRead {
  return {
    sections: [
      { name: "Ticket", first: ticket.first, last: ticket.last, filled: true, bodyLines: 1 },
    ],
    units: units.map((unit, index) => ({ number: index + 1, ...unit })),
  } as unknown as PlanRead;
}

/** The text has a Ticket section at lines 1 to 4 and then a Decisions section. */
function textWith(footer: string[], after = ""): { text: string; plan: PlanRead } {
  const lines = ["## Ticket", "", ...footer];
  const last = lines.length;
  const text = [...lines, "", "## Decisions", "", after].join("\n");
  return { text, plan: planOf({ first: 1, last }) };
}

async function tickets(footer: string[], after = ""): Promise<number> {
  const { readConditions } = await load();
  const { text, plan } = textWith(footer, after);
  return readConditions(text, plan).dependentTickets;
}

describe("readConditions", () => {
  it("counts the three dependent tickets of a ticket footer", async () => {
    expect(await tickets(["**Size: M** · Blocked by: #89 · Feeds: #91, #92, #108"])).toBe(3);
  });

  it("counts none for Feeds: none", async () => {
    expect(await tickets(["Size: M · Feeds: none"])).toBe(0);
  });

  it("counts none for Feeds: None", async () => {
    expect(await tickets(["Size: M · Feeds: None"])).toBe(0);
  });

  it("counts none when the Ticket section has no Feeds line", async () => {
    expect(await tickets(["**Size: M** · Blocked by: #89"])).toBe(0);
  });

  it("counts none when the only Feeds line is outside the Ticket section", async () => {
    expect(await tickets(["Size: M"], "Feeds: #91, #92")).toBe(0);
  });

  it("reads the last Feeds line when the section holds two", async () => {
    expect(await tickets(["Feeds: #91, #92, #93", "Size: M · Feeds: #94"])).toBe(1);
  });

  it("removes the closing bold marks of the last item", async () => {
    expect(await tickets(["Size: M · Feeds: #91**"])).toBe(1);
  });

  it("sets userInterface when a unit has a Design specification line", async () => {
    const { readConditions } = await load();
    const withDesign = planOf({ first: 1, last: 1 }, [{}, { designSpecification: "a form" }]);
    expect(readConditions("## Ticket\n", withDesign).userInterface).toBe(true);
  });

  it("clears userInterface when no unit has a Design specification line", async () => {
    const { readConditions } = await load();
    const without = planOf({ first: 1, last: 1 }, [{}, {}]);
    expect(readConditions("## Ticket\n", without).userInterface).toBe(false);
  });

  it("clears newStructuralDecision when the plan holds the sentence", async () => {
    const { readConditions } = await load();
    const text = "Small change. No new decision since the question round.";
    expect(readConditions(text, planOf({ first: 1, last: 1 })).newStructuralDecision).toBe(false);
  });

  it("ignores case, spaces and line breaks in that sentence", async () => {
    const { readConditions } = await load();
    const text = "Small change. no new decision since the\nquestion  round.";
    expect(readConditions(text, planOf({ first: 1, last: 1 })).newStructuralDecision).toBe(false);
  });

  it("sets newStructuralDecision when the plan lacks the sentence", async () => {
    const { readConditions } = await load();
    const text = "A new decision was taken in the question round.";
    expect(readConditions(text, planOf({ first: 1, last: 1 })).newStructuralDecision).toBe(true);
  });
});
