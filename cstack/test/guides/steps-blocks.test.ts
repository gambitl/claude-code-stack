import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { guide } from "../../src/commands/guide.js";
import { readSteps } from "../../src/guide-steps.js";
import type { Io } from "../../src/io.js";
import { PHASES } from "../../src/phases.js";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

function rawGuide(phase: string): string {
  return readFileSync(`${packageRoot}/guides/resolve-issue/${phase}.md`, "utf8");
}

describe("the block of mandatory steps of each phase guide", () => {
  it.each(PHASES.map((phase) => phase.name))("%s: the block is read and holds at least one step", (phase) => {
    const result = readSteps(rawGuide(phase), `${phase}.md`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it.each(PHASES.map((phase) => phase.name))("%s: the block has the command that closes its own phase", (phase) => {
    const result = readSteps(rawGuide(phase), `${phase}.md`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const own = `cstack next --done ${phase}`;
    const closing = result.steps.filter(
      (step) => step.kind === "command" && (step.command === own || step.command.startsWith(`${own} `)),
    );
    expect(closing.length).toBeGreaterThan(0);
  });

  it.each(PHASES.map((phase) => phase.name))("%s: cstack guide prints the prose after the block", async (phase) => {
    const raw = rawGuide(phase);
    expect(raw.startsWith("<!-- mandatory steps\n")).toBe(true);
    const marker = "\n-->\n\n";
    const cut = raw.indexOf(marker);
    expect(cut).toBeGreaterThan(0);
    const out = { stdout: "", stderr: "" };
    const io: Io = {
      stdout: (text) => {
        out.stdout += text;
      },
      stderr: (text) => {
        out.stderr += text;
      },
    };
    const code = await guide([phase], io, { packageRoot });
    expect(code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout).toBe(raw.slice(cut + marker.length));
  });
});
