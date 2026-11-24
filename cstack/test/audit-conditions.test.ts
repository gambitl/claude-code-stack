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

  describe("decision records of the documentation duties", () => {
    /** A plan with a Decisions section and then a Documentation duties section. */
    function dutiesPlan(duties: string[], decisions: string[] = []) {
      const lines = ["## Decisions", "", ...decisions, ""];
      const first = lines.length + 1;
      lines.push("## Documentation duties", "", ...duties);
      const last = lines.length;
      const plan = {
        sections: [
          { name: "Decisions", first: 1, last: first - 1, filled: true, bodyLines: 1 },
          { name: "Documentation duties", first, last, filled: true, bodyLines: 1 },
        ],
        units: [],
      } as unknown as PlanRead;
      return { text: lines.join("\n"), plan };
    }

    async function read(duties: string[], decisions: string[] = []) {
      const { readConditions } = await load();
      const { text, plan } = dutiesPlan(duties, decisions);
      const c = readConditions(text, plan);
      return { bigDecision: c.bigDecision, recordFiles: c.recordFiles, recordNames: c.recordNames };
    }

    const A = "docs/decisions/ADR-SAMPLE-A-sample.md";
    const B = "docs/decisions/ADR-SAMPLE-B-other.md";

    it("sets bigDecision for a duty that names a record and says applies", async () => {
      expect(await read([`- ADR-SAMPLE-A: applies, written to \`${A}\` by unit 2.`])).toEqual({
        bigDecision: true,
        recordFiles: [A],
        recordNames: ["ADR-SAMPLE-A"],
      });
    });

    it("accepts the path of the record before the colon", async () => {
      expect(await read([`- ADR-SAMPLE-A (\`${A}\`): applies, a short section added.`])).toEqual({
        bigDecision: true,
        recordFiles: [A],
        recordNames: ["ADR-SAMPLE-A"],
      });
    });

    it("accepts the words decision record in any case", async () => {
      const r = await read([`- Decision Record: Applies, written to \`${B}\`.`]);
      expect(r.bigDecision).toBe(true);
      expect(r.recordNames).toEqual(["ADR-SAMPLE-B"]);
    });

    it("clears bigDecision for a duty that does not apply", async () => {
      expect(await read(["- Architecture decision record: does not apply."])).toEqual({
        bigDecision: false,
        recordFiles: [],
        recordNames: [],
      });
    });

    it("ignores a duty that names a record only after its colon", async () => {
      const r = await read(["- The comment on this ticket: applies, it names ADR-SAMPLE-A."]);
      expect(r.bigDecision).toBe(false);
    });

    it("ignores the word ADR inside a longer word", async () => {
      const r = await read(["- The ADRESSE page: applies, written to the wiki."]);
      expect(r.bigDecision).toBe(false);
    });

    it("ignores a matching line outside the Documentation duties section", async () => {
      const r = await read(
        ["- A decision record: does not apply."],
        [`- ADR-SAMPLE-A: applies, written to \`${A}\`.`],
      );
      expect(r.bigDecision).toBe(false);
    });

    it("ignores the placeholder of the template", async () => {
      const r = await read([
        '<phase document: each duty "applies, written to <place>" or "does not apply">',
      ]);
      expect(r.bigDecision).toBe(false);
    });

    it("keeps only the paths in backticks that end in .md", async () => {
      const r = await read([
        `- ADR-SAMPLE-A: applies, written to \`${A}\`, with a comment in \`src/a.ts\`.`,
      ]);
      expect(r.recordFiles).toEqual([A]);
    });

    it("names the record by the text before the colon when the duty names no .md file", async () => {
      expect(await read(["- ADR-157: applies, written to the wiki page of the team."])).toEqual({
        bigDecision: true,
        recordFiles: [],
        recordNames: ["ADR-157"],
      });
    });

    it("lists each file and each name once over two duties", async () => {
      const r = await read([
        `- ADR-SAMPLE-A: applies, written to \`${A}\`.`,
        `- ADR-SAMPLE-A again: applies, a section in \`${A}\`.`,
        `- ADR-SAMPLE-B: applies, written to \`${B}\`.`,
      ]);
      expect(r.recordFiles).toEqual([A, B]);
      expect(r.recordNames).toEqual(["ADR-SAMPLE-A", "ADR-SAMPLE-B"]);
    });
  });
});
