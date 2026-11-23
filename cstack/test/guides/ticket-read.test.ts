import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withoutBlock } from "../../src/guide-steps.js";
import { claudeFileTracker } from "../../src/tracker/claude-file.js";

const rawGuide = readFileSync(fileURLToPath(new URL("../../guides/resolve-issue/ticket.md", import.meta.url)), "utf8");
// The prose of the guide, as `cstack guide` prints it, without its block of mandatory steps.
const prose = withoutBlock(rawGuide, "guides/resolve-issue/ticket.md");
if (!prose.ok) throw new Error(prose.message);
const guide = prose.text;
const examplePath = fileURLToPath(new URL("../../skills/resolve-issue/templates/tracker-file.json", import.meta.url));

describe("the ticket guide reads the ticket with cstack tracker read", () => {
  it("names the command, exit code 4, the example file and --from-file in one paragraph", () => {
    const paragraph = guide.split("\n\n").find((p) => p.includes("cstack tracker read '<key>' --tracker <name>"));
    expect(paragraph, "no paragraph names the read command").toBeDefined();
    expect(paragraph).toContain("`4`");
    expect(paragraph).toContain("templates/tracker-file.json");
    expect(paragraph).toContain("--from-file <file>");
  });

  it("names the key forms of each tracker in the paragraph of the read command", () => {
    const paragraph = guide.split("\n\n").find((p) => p.includes("cstack tracker read '<key>' --tracker <name>"));
    expect(paragraph).toContain("`'#12'`");
    expect(paragraph).toContain("`12`");
    expect(paragraph).toContain("the issue link");
    expect(paragraph).toContain("`ABC-12`");
  });

  it("says in the next paragraph that the answer holds only some fields", () => {
    const paragraphs = guide.split("\n\n");
    const index = paragraphs.findIndex((p) => p.includes("cstack tracker read '<key>' --tracker <name>"));
    expect(paragraphs[index + 1]).toContain("holds only the key, title, body, link, state and blockers");
    expect(paragraphs[index + 1]).toContain("tracker's own tool");
  });

  it("ships an example file that the file reader of cstack reads back", async () => {
    const example = JSON.parse(readFileSync(examplePath, "utf8"));
    expect(Object.keys(example).sort()).toEqual(["format", "tickets", "tracker"]);
    expect(example.format).toBe("cstack-tracker/1");
    const warnings: string[] = [];
    const tracker = claudeFileTracker(examplePath, "github", (m) => warnings.push(m));
    const ticket = await tracker.readTicket(example.tickets[0].key);
    expect(ticket.title).toBe(example.tickets[0].title);
    expect(warnings).toEqual([]);
  });
});
