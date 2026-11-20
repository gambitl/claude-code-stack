import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Io } from "../src/io.js";
import { skills } from "../src/commands/skills.js";

const packageRoot = new URL("..", import.meta.url).pathname;
const skillSource = join(packageRoot, "skills", "resolve-issue");

const PROMPTS = [
  "code-architect",
  "code-explorer",
  "code-reviewer",
  "code-reviewer-deep",
  "code-reviewer-simplicity",
  "cto-review",
  "executor",
  "implementer",
  "implementer-escalation",
  "pr-reviewer",
];

function files(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...files(path));
    else found.push(path);
  }
  return found;
}

describe("the resolve-issue skill as installed", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "cstack-skills-package-"));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  async function install() {
    const io: Io = { stdout: () => {}, stderr: () => {} };
    const code = await skills(["install"], io, { home, packageRoot });
    expect(code).toBe(0);
    return join(home, ".claude", "skills", "resolve-issue");
  }

  it("installs the ten agent prompts, the templates, the plugin file, the writing guide and the settled decisions", async () => {
    const installed = await install();
    const expected = [
      ...PROMPTS.map((name) => `agents/${name}.md`),
      "templates/plan.md",
      "templates/settings.json",
      "templates/retro.md",
      "templates/tracker-file.json",
      ".claude-plugin/plugin.json",
      "writing.md",
      "settled-decisions.md",
    ];
    for (const path of expected) {
      expect(existsSync(join(installed, path)), `${path} is missing`).toBe(true);
    }
  });

  it("installs every file of the package, hidden files included, byte for byte", async () => {
    const installed = await install();
    for (const source of files(skillSource)) {
      const path = relative(skillSource, source);
      expect(readFileSync(join(installed, path)).equals(readFileSync(source)), path).toBe(true);
    }
  });
});
