import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(new URL(`../../guides/resolve-issue/${name}.md`, import.meta.url), "utf8");
const document = read("document");
const publish = read("publish");

const section = (text: string, from: string, to: string) =>
  text.slice(text.indexOf(from), text.indexOf(to));
const writeBack = section(document, "## Write back into the ticket", "## Hand the context down");
const handDown = section(document, "## Hand the context down", "## Record every big decision");
const exitZero = section(publish, "## Exit code 0", "## Exit code 6");

const comment = `cstack tracker comment '<key>' --body-file <file> --tracker <name>`;

describe("the tracker writes of the document guide", () => {
  for (const [name, text] of [
    ["Write back into the ticket", writeBack],
    ["Hand the context down", handDown],
  ] as const) {
    it(`posts the comment with cstack in "${name}"`, () => {
      expect(text).toContain(comment);
      expect(text).toContain("exit code `4`");
      expect(text).toContain("own connection");
    });
  }

  it("no longer says the writes go through direct connections", () => {
    expect(document).not.toContain("through their direct connections");
  });
});

describe("the move to in review in the publish guide", () => {
  it("uses cstack tracker move in step 1 of exit code 0", () => {
    const step1 = exitZero.split("\n").find((l) => l.startsWith("1."))!;
    expect(step1).toContain(`cstack tracker move '<key>' --to "in review" --tracker <name>`);
    expect(exitZero).toContain("exit code `4`");
    expect(exitZero).toContain("own connection");
    expect(exitZero).toMatch(/never create (a|the) label/i);
  });
});
