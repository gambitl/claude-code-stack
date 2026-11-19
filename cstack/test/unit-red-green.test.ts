import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { unitGreen } from "../src/commands/unit-green.js";
import type { Io } from "../src/io.js";
import { git } from "./helpers/plan-repo.js";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const approved = readFileSync(new URL("./fixtures/plans/approved.md", import.meta.url), "utf8");

function planText(units: string[]): string {
  const head = approved.slice(0, approved.indexOf("## Implementation units"));
  const tail = approved.slice(approved.indexOf("## Documentation duties"));
  const body = units
    .map(
      (line, i) =>
        `### Unit ${i + 1}: Thing ${i + 1}\n- Files: \`src/a.ts\`, \`test/a.test.ts\`\n${line}\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: \`feat(cli): add ${i + 1}\`\n- Depends on: none\n`,
    )
    .join("\n");
  return `${head}## Implementation units\n\n${body}\n${tail}`;
}

const TEST_LINE = "- Test: `test/a.test.ts`: a case.";

function setup(units: string[] = [TEST_LINE], settings: string | null = '{"version":1,"testCommands":{"all":"true"}}') {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "cstack-green-")));
  made.push(dir);
  git(dir, "init", "-b", "main");
  writeFileSync(join(dir, "start.txt"), "x");
  git(dir, "add", ".");
  git(dir, "commit", "-m", "chore: start");
  git(dir, "switch", "-c", "feature");
  writeFileSync(join(dir, "plan.md"), planText(units));
  git(dir, "add", "plan.md");
  git(dir, "commit", "-m", "docs: plan");
  if (settings !== null) {
    mkdirSync(join(dir, ".cstack"));
    writeFileSync(join(dir, ".cstack/settings.json"), settings);
  }
  mkdirSync(join(dir, "test"));
  writeFileSync(join(dir, "test/a.test.ts"), "x");
  return dir;
}

const runDir = (dir: string) => join(dir, ".git/cstack/runs/plan");

function saveRed(dir: string, n = 1) {
  const folder = join(runDir(dir), "units", String(n));
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "red.json"),
    JSON.stringify({ time: new Date().toISOString(), command: "true", exitCode: 1, commit: "x", testFile: "test/a.test.ts", testFileSha256: "0" }),
  );
}

async function green(dir: string, ...args: string[]) {
  const out = { stdout: "", stderr: "" };
  const io: Io = { stdout: (t) => (out.stdout += t), stderr: (t) => (out.stderr += t) };
  const code = await unitGreen(args.length ? args : ["1", "--plan", "plan.md"], io, dir);
  return { code, ...out };
}

describe("cstack unit green, refusals before the test runs", () => {
  it("refuses a unit with no saved failing run and saves nothing", async () => {
    const dir = setup();
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("cstack unit red 1");
    expect(existsSync(join(runDir(dir), "units", "1"))).toBe(false);
  });

  it("refuses a unit with a No test line and gives the reason", async () => {
    const dir = setup(["- No test: documentation only"]);
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("documentation only");
    expect(r.stderr).toContain("cstack unit commit 1");
  });

  it("exits with 3 for a unit with neither a Test line nor a No test line", async () => {
    const dir = setup(["- Notes: nothing"]);
    const r = await green(dir);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("Unit 1");
  });

  it("exits with 3 for a No test line with an empty reason", async () => {
    const dir = setup(["- No test:"]);
    const r = await green(dir);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("No test");
  });

  it("exits with 3 and names testCommands.all when there is no settings file", async () => {
    const dir = setup([TEST_LINE], null);
    saveRed(dir);
    const r = await green(dir);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("testCommands.all");
  });

  it("exits with 3 for an invalid settings file", async () => {
    const dir = setup([TEST_LINE], "{ nope");
    saveRed(dir);
    const r = await green(dir);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("settings.json");
  });

  it("exits with 2 for a unit that is not in the plan", async () => {
    const dir = setup();
    const r = await green(dir, "9", "--plan", "plan.md");
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("units 1");
  });

  it.each(["0", "abc", "1441"])("exits with 2 for --timeout %s", async (value) => {
    const dir = setup();
    saveRed(dir);
    const r = await green(dir, "1", "--plan", "plan.md", "--timeout", value);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage: cstack unit green");
  });

  it("exits with 2 when there is no unit number", async () => {
    const dir = setup();
    expect((await green(dir, "--plan", "plan.md")).code).toBe(2);
  });

  it("exits with 1 and names a missing test file", async () => {
    const dir = setup();
    saveRed(dir);
    rmSync(join(dir, "test/a.test.ts"));
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("test/a.test.ts");
  });

  it("exits with 1 for a test file that links outside the repository", async () => {
    const dir = setup();
    saveRed(dir);
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "cstack-outside-")));
    made.push(outside);
    writeFileSync(join(outside, "t.ts"), "x");
    rmSync(join(dir, "test/a.test.ts"));
    symlinkSync(join(outside, "t.ts"), join(dir, "test/a.test.ts"));
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("outside the work tree");
  });
});
