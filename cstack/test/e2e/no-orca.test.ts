// The tracker chain, run without a usable Orca: with no `orca` program, with an Orca older than the minimum, and with an Orca that is closed.
// Every cstack command is the built cstack in a child process. The `gh` that cstack reaches is the fake program of test/e2e/bin.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createChain, type Chain } from "./chain.js";

const CSTACK = join(import.meta.dirname, "..", "..");
const GUIDES = join(CSTACK, "guides", "resolve-issue");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");
const TICKET_GUIDE = read(GUIDES, "ticket.md");
const DOCUMENT_GUIDE = read(GUIDES, "document.md");
const PUBLISH_GUIDE = read(GUIDES, "publish.md");

const REPO = "github.com/example-owner/example-repo";

const runs = [
  { name: "no orca on the PATH", options: { orca: false } },
  { name: "an Orca older than 1.4.259", options: { orca: true, orcaMode: "old" as const } },
  { name: "a closed Orca", options: { orca: true, orcaMode: "closed" as const } },
];

describe.each(runs)("the chain with $name", ({ options }) => {
  let chain: Chain;

  beforeAll(async () => {
    chain = await createChain(options);
  }, 180_000);

  afterAll(() => chain?.cleanup());

  it("reads, comments and moves the ticket through the fake gh", () => {
    const ticket = chain.follow(TICKET_GUIDE, ["tracker", "read", "#4", "--tracker", "github"]);
    expect(ticket.code, ticket.stderr).toBe(0);
    const file = join(chain.temp, "comment.md");
    writeFileSync(file, "The squares are in place.\n");
    const posted = chain.follow(DOCUMENT_GUIDE, ["tracker", "comment", "#4", "--body-file", file, "--tracker", "github"]);
    expect(posted.code, posted.stderr).toBe(0);
    const moved = chain.follow(PUBLISH_GUIDE, ["tracker", "move", "#4", "--to", "in review", "--tracker", "github"]);
    expect(moved.code, moved.stderr).toBe(0);
    const edits = chain.ghCalls().filter((c) => c.args[0] === "issue" && c.args[1] === "edit");
    expect(edits.at(-1)!.args).toEqual(["issue", "edit", "4", "--repo", REPO, "--add-label", "in review", "--remove-label", "in progress"]);
  });
});

describe("the tracker commands with no gh on the PATH", { timeout: 120_000 }, () => {
  let chain: Chain;

  beforeAll(async () => {
    chain = await createChain({ orca: false, gh: false });
  }, 180_000);

  afterAll(() => chain?.cleanup());

  it("exits with 4 for read, move and comment", () => {
    expect(chain.pathPrograms()).toEqual(["git", "node"]);
    const file = join(chain.temp, "comment.md");
    writeFileSync(file, "A comment.\n");
    for (const args of [
      ["tracker", "read", "#4", "--tracker", "github"],
      ["tracker", "move", "#4", "--to", "in review", "--tracker", "github"],
      ["tracker", "comment", "#4", "--body-file", file, "--tracker", "github"],
    ]) {
      const result = chain.run(args);
      expect(result.code, `${args.join(" ")}: ${result.stderr}`).toBe(4);
    }
  });
});
