import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { unitRed } from "../src/commands/unit-red.js";
import { unitGreen } from "../src/commands/unit-green.js";
import type { Io } from "../src/io.js";
import { git } from "./helpers/plan-repo.js";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const approved = readFileSync(new URL("./fixtures/plans/approved.md", import.meta.url), "utf8");

function planText(units: string[], filesLine = "`src/a.ts`, `test/a.test.ts`"): string {
  const head = approved.slice(0, approved.indexOf("## Implementation units"));
  const tail = approved.slice(approved.indexOf("## Documentation duties"));
  const body = units
    .map(
      (line, i) =>
        `### Unit ${i + 1}: Thing ${i + 1}\n- Files: ${filesLine}\n${line}\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: \`feat(cli): add ${i + 1}\`\n- Depends on: none\n`,
    )
    .join("\n");
  return `${head}## Implementation units\n\n${body}\n${tail}`;
}

const TEST_LINE = "- Test: `test/a.test.ts`: a case.";

function setup(units: string[] = [TEST_LINE], settings: string | null = '{"version":1,"testCommands":{"all":"true"}}', filesLine?: string) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "cstack-green-")));
  made.push(dir);
  git(dir, "init", "-b", "main");
  writeFileSync(join(dir, "start.txt"), "x");
  git(dir, "add", ".");
  git(dir, "commit", "-m", "chore: start");
  git(dir, "switch", "-c", "feature");
  writeFileSync(join(dir, "plan.md"), planText(units, filesLine));
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

const FILE_SETTINGS = '{"version":1,"testCommands":{"all":"sh test/a.test.ts","file":"sh {file}"}}';

async function red(dir: string, ...args: string[]) {
  const out = { stdout: "", stderr: "" };
  const io: Io = { stdout: (t) => (out.stdout += t), stderr: (t) => (out.stderr += t) };
  const code = await unitRed(args.length ? args : ["1", "--plan", "plan.md"], io, dir);
  return { code, ...out };
}

const readRed = (dir: string, n = 1) => JSON.parse(readFileSync(join(runDir(dir), "units", String(n), "red.json"), "utf8"));
const unitFiles = (dir: string, n = 1) => join(runDir(dir), "units", String(n));

describe("cstack unit red", () => {
  it("saves a failing run and prints the last lines and the verdict", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "echo boom\nexit 1\n");
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("boom");
    expect(r.stdout).toContain("red.json");
    expect(r.stdout).not.toContain("whole test suite");
    const saved = readRed(dir);
    expect(saved.command).toBe('sh "$1"');
    expect(saved.exitCode).toBe(1);
    expect(saved.testFile).toBe("test/a.test.ts");
    expect(saved.commit).toBe(git(dir, "rev-parse", "HEAD").trim());
    expect(saved.testFileSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Number.isNaN(Date.parse(saved.time))).toBe(false);
    expect(readFileSync(join(unitFiles(dir), "red.log"), "utf8")).toContain("boom");
  });

  it("exits with 1 for a passing test and saves nothing", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 0\n");
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("proves nothing yet");
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("exits with 5 when the test command does not exist", async () => {
    const dir = setup([TEST_LINE], '{"version":1,"testCommands":{"all":"cstack-no-such-program"}}');
    const r = await red(dir);
    expect(r.code).toBe(5);
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("exits with 5 at the timeout and saves nothing", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "sleep 30\n");
    const r = await red(dir, "1", "--plan", "plan.md", "--timeout", "0.01");
    expect(r.code).toBe(5);
    expect(r.stderr).toContain("0.01 minutes");
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("refuses a unit with a No test line", async () => {
    const r = await red(setup(["- No test: documentation only"], FILE_SETTINGS));
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("documentation only");
  });

  it("exits with 3 for a unit with neither line", async () => {
    const r = await red(setup(["- Notes: nothing"], FILE_SETTINGS));
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("Unit 1");
  });

  it("exits with 3 for a No test line with an empty reason", async () => {
    const r = await red(setup(["- No test:"], FILE_SETTINGS));
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("No test");
  });

  it("exits with 3 and names testCommands.all without settings", async () => {
    const r = await red(setup([TEST_LINE], null));
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("testCommands.all");
  });

  it("runs the whole suite without testCommands.file and says so", async () => {
    const dir = setup([TEST_LINE], '{"version":1,"testCommands":{"all":"echo suite; exit 2"}}');
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("suite");
    expect(r.stdout).toContain("whole test suite");
    expect(readRed(dir).command).toBe("echo suite; exit 2");
  });

  it("ends the test output with a line break before the verdict", async () => {
    const dir = setup([TEST_LINE], '{"version":1,"testCommands":{"all":"printf fail; exit 1"}}');
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^fail\ncstack unit red: /);
  });

  it("exits with 1 when the Test path is a directory", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    rmSync(join(dir, "test/a.test.ts"));
    mkdirSync(join(dir, "test/a.test.ts"));
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("test/a.test.ts");
    expect(r.stderr).toContain("not a file");
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("deletes a saved passing run after a new failing run, and keeps it after a refused run", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    mkdirSync(unitFiles(dir), { recursive: true });
    writeFileSync(join(unitFiles(dir), "green.json"), "{}");
    writeFileSync(join(unitFiles(dir), "green.log"), "x");
    writeFileSync(join(dir, "test/a.test.ts"), "exit 0\n");
    expect((await red(dir)).code).toBe(1);
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(true);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    expect((await red(dir)).code).toBe(0);
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
    expect(existsSync(join(unitFiles(dir), "green.log"))).toBe(false);
  });

  it("saves both failing runs of two units run at the same time in two processes", async () => {
    const dir = setup([TEST_LINE, TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "sleep 0.3\nexit 1\n");
    const source = new URL("../src/commands/unit-red.ts", import.meta.url).href;
    // WHY: the sources import "./x.js" and use parameter properties, which node cannot strip. This hook maps .js to .ts
    // and compiles the .ts files with the transform that vite, which runs these tests, already ships.
    const hookPath = join(dir, "hook.mjs");
    writeFileSync(hookPath, `
      import { transformWithOxc } from ${JSON.stringify(import.meta.resolve("vite"))};
      import { readFileSync } from "node:fs";
      export async function resolve(s, c, next) {
        try { return await next(s, c); } catch (e) { if (s.endsWith(".js")) return next(s.slice(0, -3) + ".ts", c); throw e; }
      }
      export async function load(url, c, next) {
        if (!url.endsWith(".ts")) return next(url, c);
        const out = await transformWithOxc(readFileSync(new URL(url), "utf8"), new URL(url).pathname);
        return { format: "module", shortCircuit: true, source: out.code };
      }
    `);
    const hook = pathToFileURL(hookPath).href;
    const child = `
      import { register } from "node:module";
      register(${JSON.stringify(hook)});
      const { unitRed } = await import(${JSON.stringify(source)});
      const io = { stdout() {}, stderr: (t) => process.stderr.write(t) };
      process.exitCode = await unitRed([process.argv[1], "--plan", "plan.md"], io, process.argv[2]);
    `;
    const codes = await Promise.all(
      ["1", "2"].map(
        (unit) =>
          new Promise<number | null>((resolve) => {
            spawn(process.execPath, ["--input-type=module", "-e", child, unit, dir], { stdio: "inherit" }).on("exit", resolve);
          }),
      ),
    );
    expect(codes).toEqual([0, 0]);
    expect(readRed(dir, 1).exitCode).toBe(1);
    expect(readRed(dir, 2).exitCode).toBe(1);
  }, 30_000);
});

describe("cstack unit red, files of the unit that already changed", () => {
  function committed(filesLine?: string) {
    const dir = setup([TEST_LINE], FILE_SETTINGS, filesLine);
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "old");
    git(dir, "add", "src/a.ts");
    git(dir, "commit", "-m", "feat: a");
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    return dir;
  }
  const expectRestart = (stderr: string) => {
    expect(stderr).toContain("must fail before any code of the unit exists");
    expect(stderr).toContain("moving code aside to get a failure is not allowed");
    expect(stderr).toContain("git restore");
    expect(stderr).toContain("stuck");
    expect(stderr).toContain("cstack unit red 1");
  };

  it("refuses a changed code file and saves nothing", async () => {
    const dir = committed();
    writeFileSync(join(dir, "src/a.ts"), "new");
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("src/a.ts (changed)");
    expectRestart(r.stderr);
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("refuses a new code file", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "new");
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("src/a.ts (new)");
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("refuses a deleted code file", async () => {
    const dir = committed();
    rmSync(join(dir, "src/a.ts"));
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("src/a.ts (deleted)");
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("leaves an earlier red.json and green.json as they were after a refusal", async () => {
    const dir = committed();
    saveRed(dir);
    writeFileSync(join(unitFiles(dir), "green.json"), "{}");
    const before = readFileSync(join(unitFiles(dir), "red.json"), "utf8");
    writeFileSync(join(dir, "src/a.ts"), "new");
    expect((await red(dir)).code).toBe(1);
    expect(readFileSync(join(unitFiles(dir), "red.json"), "utf8")).toBe(before);
    expect(readFileSync(join(unitFiles(dir), "green.json"), "utf8")).toBe("{}");
  });

  it("exits with 5 with the message of git when the index is damaged, and saves nothing", async () => {
    const dir = committed();
    writeFileSync(join(dir, ".git/index"), "damaged");
    const r = await red(dir);
    expect(r.code).toBe(5);
    expect(r.stderr).not.toBe("");
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("accepts a unit where only the test file and a fixture changed", async () => {
    const dir = committed("`src/a.ts`, `test/a.test.ts`, `test/fixtures/a.json`");
    mkdirSync(join(dir, "test/fixtures"));
    writeFileSync(join(dir, "test/fixtures/a.json"), "{}");
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(existsSync(join(unitFiles(dir), "red.json"))).toBe(true);
  });

  it("accepts a unit whose new module does not exist yet", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    expect((await red(dir)).code).toBe(0);
  });
});

describe("cstack unit green, running the test", () => {
  async function redThenCode(settings = FILE_SETTINGS) {
    const dir = setup([TEST_LINE], settings);
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n");
    expect((await red(dir)).code).toBe(0);
    return dir;
  }
  const code = (dir: string) => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/feature.txt"), "x");
  };
  const readGreen = (dir: string) => JSON.parse(readFileSync(join(unitFiles(dir), "green.json"), "utf8"));

  it("saves the passing run after the code is written", async () => {
    const dir = await redThenCode();
    await new Promise((r) => setTimeout(r, 20));
    code(dir);
    const r = await green(dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("green.json");
    expect(r.stderr).toBe("");
    const saved = readGreen(dir);
    expect(saved.exitCode).toBe(0);
    expect(Date.parse(saved.time)).toBeGreaterThan(Date.parse(readRed(dir).time));
    expect(existsSync(join(unitFiles(dir), "green.log"))).toBe(true);
  });

  it("exits with 1 and saves nothing while the test still fails", async () => {
    const dir = await redThenCode();
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("still fails");
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
  });

  it("deletes the earlier passing run when the test fails again", async () => {
    const dir = await redThenCode();
    code(dir);
    expect((await green(dir)).code).toBe(0);
    rmSync(join(dir, "src/feature.txt"));
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("earlier passing run is deleted");
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
    expect(existsSync(join(unitFiles(dir), "green.log"))).toBe(false);
    expect(existsSync(join(unitFiles(dir), "red.json"))).toBe(true);
  });

  it("ends the test output with a line break before the verdict", async () => {
    const dir = setup([TEST_LINE], '{"version":1,"testCommands":{"all":"printf fail; exit 1"}}');
    expect((await red(dir)).code).toBe(0);
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe("fail\n");
  });

  it("exits with 1 and runs nothing when the settings changed since the failing run", async () => {
    const dir = await redThenCode();
    code(dir);
    writeFileSync(join(dir, ".cstack/settings.json"), '{"version":1,"testCommands":{"all":"true","file":"sh -e {file}"}}');
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("cstack unit red 1");
    expect(r.stderr).not.toContain("Set the code aside");
    expect(r.stderr).toContain("git restore");
    expect(r.stderr).toContain("stuck");
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
  });

  it("warns when the test file changed but the test passes", async () => {
    const dir = await redThenCode();
    code(dir);
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n# edited\n");
    const r = await green(dir);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("changed since the failing run");
  });

  it("exits with 5 when the test command cannot start", async () => {
    const dir = setup([TEST_LINE], '{"version":1,"testCommands":{"all":"cstack-no-such-program"}}');
    saveRed(dir);
    writeFileSync(join(runDir(dir), "units/1/red.json"), JSON.stringify({ time: new Date().toISOString(), command: "cstack-no-such-program", exitCode: 1, commit: "x", testFile: "test/a.test.ts", testFileSha256: "0" }));
    const r = await green(dir);
    expect(r.code).toBe(5);
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
  });

  it("exits with 5 at the timeout", async () => {
    const dir = await redThenCode();
    writeFileSync(join(dir, "test/a.test.ts"), "sleep 30\n");
    const r = await green(dir, "1", "--plan", "plan.md", "--timeout", "0.01");
    expect(r.code).toBe(5);
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
  });

  it.each([
    ["reaches the timeout", "sleep 30\n"],
    ["cannot start", "exit 127\n"],
  ])("deletes the earlier passing run when the test %s", async (_case, body) => {
    const dir = await redThenCode();
    code(dir);
    expect((await green(dir)).code).toBe(0);
    writeFileSync(join(dir, "test/a.test.ts"), body);
    const r = await green(dir, "1", "--plan", "plan.md", "--timeout", "0.01");
    expect(r.code).toBe(5);
    expect(r.stderr).toContain("earlier passing run is deleted");
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
    expect(existsSync(join(unitFiles(dir), "green.log"))).toBe(false);
    expect(existsSync(join(unitFiles(dir), "red.json"))).toBe(true);
  });
});

describe("cstack unit green, code older than the latest failing run", () => {
  async function redThenCode() {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n");
    expect((await red(dir)).code).toBe(0);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/feature.txt"), "x");
    return dir;
  }
  const redFile = (dir: string) => join(unitFiles(dir), "red.json");
  const startedAt = (dir: string) => Date.parse(JSON.parse(readFileSync(redFile(dir), "utf8")).startedAt);
  const stamp = (path: string, ms: number) => utimesSync(path, ms / 1000, ms / 1000);
  const writeA = (dir: string, ms: number) => {
    writeFileSync(join(dir, "src/a.ts"), "code");
    stamp(join(dir, "src/a.ts"), ms);
  };

  it("saves startedAt in red.json, no later than time", async () => {
    const dir = await redThenCode();
    const saved = JSON.parse(readFileSync(redFile(dir), "utf8"));
    expect(Number.isNaN(Date.parse(saved.startedAt))).toBe(false);
    expect(Date.parse(saved.startedAt)).toBeLessThanOrEqual(Date.parse(saved.time));
  });

  it("refuses a code file 60 seconds older, names it, runs no test and deletes the earlier passing run", async () => {
    const dir = await redThenCode();
    writeFileSync(join(unitFiles(dir), "green.json"), "{}");
    writeFileSync(join(unitFiles(dir), "green.log"), "old");
    writeA(dir, startedAt(dir) - 60_000);
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("src/a.ts");
    expect(r.stderr).toContain("git restore");
    expect(r.stderr).toContain("cstack unit red 1");
    expect(r.stderr).toContain("earlier passing run is deleted");
    expect(r.stdout).toBe("");
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
    expect(existsSync(join(unitFiles(dir), "green.log"))).toBe(false);
  });

  it("saves no green.json when it refuses", async () => {
    const dir = await redThenCode();
    writeA(dir, startedAt(dir) - 60_000);
    await green(dir);
    expect(existsSync(join(unitFiles(dir), "green.json"))).toBe(false);
  });

  it("accepts a code file 60 seconds newer", async () => {
    const dir = await redThenCode();
    writeA(dir, startedAt(dir) + 60_000);
    expect((await green(dir)).code).toBe(0);
  });

  it("accepts a code file one second older, inside the margin", async () => {
    const dir = await redThenCode();
    writeA(dir, startedAt(dir) - 1_000);
    expect((await green(dir)).code).toBe(0);
  });

  it("uses time when red.json has no startedAt", async () => {
    const dir = await redThenCode();
    const saved = JSON.parse(readFileSync(redFile(dir), "utf8"));
    delete saved.startedAt;
    saved.time = new Date(Date.now() + 3_600_000).toISOString();
    writeFileSync(redFile(dir), JSON.stringify(saved));
    writeA(dir, Date.now());
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("src/a.ts");
  });

  it("uses startedAt, not time, when startedAt is older than time", async () => {
    const dir = await redThenCode();
    const saved = JSON.parse(readFileSync(redFile(dir), "utf8"));
    saved.startedAt = new Date(Date.now() - 3_600_000).toISOString();
    saved.time = new Date(Date.now() + 3_600_000).toISOString();
    writeFileSync(redFile(dir), JSON.stringify(saved));
    writeA(dir, Date.now() - 1_800_000);
    expect((await green(dir)).code).toBe(0);
  });

  it("skips a deleted code file", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "old");
    git(dir, "add", "src/a.ts");
    git(dir, "commit", "-m", "feat: a");
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n");
    expect((await red(dir)).code).toBe(0);
    writeFileSync(join(dir, "src/feature.txt"), "x");
    rmSync(join(dir, "src/a.ts"));
    expect((await green(dir)).code).toBe(0);
  });

  it("ignores an old test file and an old fixture", async () => {
    const dir = await redThenCode();
    const old = startedAt(dir) - 60_000;
    stamp(join(dir, "test/a.test.ts"), old);
    expect((await green(dir)).code).toBe(0);
  });

  it("asks for the change of the test file in the report", async () => {
    const dir = await redThenCode();
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n# edited\n");
    const r = await green(dir);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("what changed in the test and why");
  });
});

describe("cstack unit red with a per-case report", () => {
  const REPORT_SETTINGS = '{"version":1,"testCommands":{"all":"true","file":"sh {file} {report}","report":"junit"}}';
  const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  type Outcome = "passed" | "failed" | "error" | "skipped";
  function reportXml(cases: Array<[string, Outcome]>): string {
    const body = cases
      .map(([name, outcome]) => {
        const inner =
          outcome === "failed" ? '<failure message="x"/>' : outcome === "error" ? '<error message="x"/>' : outcome === "skipped" ? "<skipped/>" : "";
        return `<testcase name="${escapeXml(name)}">${inner}</testcase>`;
      })
      .join("");
    return `<testsuites><testsuite name="s">${body}</testsuite></testsuites>\n`;
  }

  function reportRepo(names: string[], cases: Array<[string, Outcome]>, exit = 1) {
    const dir = setup(
      [names.map((n) => `- Test: \`test/a.test.ts\`: ${n}`).join("\n")],
      REPORT_SETTINGS,
    );
    writeFileSync(join(dir, "test/report.xml"), reportXml(cases));
    writeFileSync(join(dir, "test/a.test.ts"), `cp test/report.xml "$1"\nexit ${exit}\n`);
    return dir;
  }

  it("refuses a unit whose named case passed, even though the file fails, and names the case", async () => {
    const dir = reportRepo(["case one", "case two"], [["case one", "passed"], ["case two", "failed"]]);
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("cstack unit red: These cases that unit 1 names do not fail before the code exists:\n");
    expect(r.stderr).toContain('  "case one" passed.\n');
    expect(r.stderr).not.toContain('"case two"');
    expect(r.stderr).toContain(
      'Each case that the plan names must fail before the code exists. Write each case name exactly as the test report names it. For vitest, that is the titles of the describe blocks and the title of the test, joined by " > ". Nothing is saved.\n',
    );
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("accepts a unit when both named cases fail, and saves each case of the report in red.json", async () => {
    const dir = reportRepo(["case one", "case two"], [["case one", "failed"], ["case two", "error"], ["old case", "passed"]]);
    const r = await red(dir);
    expect(r.code).toBe(0);
    const saved = readRed(dir);
    expect(saved.caseCheck).toBe("cases");
    expect(saved.fallback).toBeUndefined();
    expect(saved.cases).toEqual([
      { name: "case one", outcome: "failed" },
      { name: "case two", outcome: "error" },
      { name: "old case", outcome: "passed" },
    ]);
  });

  it("refuses a unit whose named case is missing from the report, and names the case", async () => {
    const dir = reportRepo(["case one", "case two"], [["case one", "failed"]]);
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('  "case two" is not in the test report.\n');
    expect(r.stderr).not.toContain('"case one"');
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("refuses a unit whose named case was skipped, and says that it never ran", async () => {
    const dir = reportRepo(["case one"], [["case one", "skipped"]]);
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('  "case one" was skipped, so it never ran. A failing beforeAll hook is a common cause.\n');
    expect(existsSync(unitFiles(dir))).toBe(false);
  });

  it("counts a named case with the outcome error as a failure", async () => {
    const dir = reportRepo(["case one"], [["case one", "error"]]);
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(readRed(dir).cases).toEqual([{ name: "case one", outcome: "error" }]);
  });

  it("refuses a named case when one of two report cases with its name passed", async () => {
    const dir = reportRepo(["case one"], [["case one", "failed"], ["case one", "passed"]]);
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('  "case one" passed.\n');
  });

  it("prints a case name longer than 60 characters whole", async () => {
    const long = "cstack unit red > refuses a unit when a named case passed before the code exists at all";
    expect(long.length).toBeGreaterThan(60);
    const dir = reportRepo([long], [[long, "passed"]]);
    const r = await red(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(`  "${long}" passed.\n`);
  });

  it("keeps the check of the whole test file without a report setting, and records it", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    const r = await red(dir);
    expect(r.code).toBe(0);
    const saved = readRed(dir);
    expect(saved.caseCheck).toBe("file");
    expect(saved.fallback).toBe("no-report");
    expect(saved.cases).toBeUndefined();
  });
});

describe("cstack unit green with a per-case report", () => {
  const REPORT_SETTINGS = '{"version":1,"testCommands":{"all":"true","file":"sh {file} {report}","report":"junit"}}';
  type Outcome = "passed" | "failed" | "error" | "skipped";
  function reportXml(cases: Array<[string, Outcome]>): string {
    const body = cases
      .map(([name, outcome]) => {
        const inner =
          outcome === "failed" ? '<failure message="x"/>' : outcome === "error" ? '<error message="x"/>' : outcome === "skipped" ? "<skipped/>" : "";
        return `<testcase name="${name}">${inner}</testcase>`;
      })
      .join("");
    return `<testsuites><testsuite name="s">${body}</testsuite></testsuites>\n`;
  }

  // The test file reports every named case as failed until src/a.ts exists. Then it reports `after` and exits with `exit`.
  async function redRepo(names: string[], after: Array<[string, Outcome]>, exit = 0) {
    const dir = setup([names.map((n) => `- Test: \`test/a.test.ts\`: ${n}`).join("\n")], REPORT_SETTINGS);
    writeFileSync(join(dir, "test/before.xml"), reportXml(names.map((n) => [n, "failed"] as [string, Outcome])));
    writeFileSync(join(dir, "test/after.xml"), reportXml(after));
    writeFileSync(
      join(dir, "test/a.test.ts"),
      `if [ -f src/a.ts ]; then touch test/ran; cp test/after.xml "$1"; exit ${exit}; fi\ncp test/before.xml "$1"\nexit 1\n`,
    );
    expect((await red(dir)).code).toBe(0);
    return dir;
  }
  const writeCode = async (dir: string) => {
    await new Promise((r) => setTimeout(r, 20));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/a.ts"), "x");
  };
  const greenFile = (dir: string) => join(unitFiles(dir), "green.json");
  const plantGreen = (dir: string) => {
    writeFileSync(greenFile(dir), "{}");
    writeFileSync(join(unitFiles(dir), "green.log"), "old");
  };

  it("refuses a unit whose named case still fails, names the case and deletes the earlier passing run", async () => {
    const dir = await redRepo(["case one", "case two"], [["case one", "passed"], ["case two", "failed"]]);
    await writeCode(dir);
    plantGreen(dir);
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("cstack unit green: These cases that unit 1 names do not pass:\n");
    expect(r.stderr).toContain('  "case two" failed.\n');
    expect(r.stderr).not.toContain('"case one"');
    expect(r.stderr).toContain("Nothing is saved, and any earlier passing run is deleted.\n");
    expect(existsSync(greenFile(dir))).toBe(false);
    expect(existsSync(join(unitFiles(dir), "green.log"))).toBe(false);
  });

  it("refuses a unit whose named case is missing from the report, even though the test command exits with 0", async () => {
    const dir = await redRepo(["case one", "case two"], [["case one", "passed"]]);
    await writeCode(dir);
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('  "case two" is not in the test report.\n');
    expect(existsSync(greenFile(dir))).toBe(false);
  });

  it("refuses a unit whose named case was skipped, even though the test command exits with 0", async () => {
    const dir = await redRepo(["case one"], [["case one", "skipped"]]);
    await writeCode(dir);
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('  "case one" was skipped, so it never ran. A failing beforeAll hook is a common cause.\n');
    expect(existsSync(greenFile(dir))).toBe(false);
  });

  it("accepts a unit when every named case passes, and saves each case of the report in green.json", async () => {
    const dir = await redRepo(["case one"], [["case one", "passed"], ["other", "passed"]]);
    await writeCode(dir);
    const r = await green(dir);
    expect(r.code).toBe(0);
    const saved = JSON.parse(readFileSync(greenFile(dir), "utf8"));
    expect(saved.caseCheck).toBe("cases");
    expect(saved.cases).toEqual([
      { name: "case one", outcome: "passed" },
      { name: "other", outcome: "passed" },
    ]);
  });

  it("refuses a named case that is not among the failing cases of red.json, runs no test and deletes the earlier passing run", async () => {
    const dir = await redRepo(["case one", "case two"], [["case one", "passed"], ["case two", "passed"]]);
    const file = join(unitFiles(dir), "red.json");
    const red1 = JSON.parse(readFileSync(file, "utf8"));
    red1.cases = [{ name: "case one", outcome: "failed" }, { name: "case two", outcome: "passed" }];
    writeFileSync(file, JSON.stringify(red1));
    await writeCode(dir);
    plantGreen(dir);
    const r = await green(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(
      'cstack unit green: These cases that unit 1 names are not among the failing cases of its saved failing run: "case two". Each named case must be seen failing before the code exists. No test ran, nothing is saved, and any earlier passing run is deleted.\n',
    );
    expect(r.stderr).toContain("cstack unit red 1");
    expect(existsSync(join(dir, "test/ran"))).toBe(false);
    expect(existsSync(greenFile(dir))).toBe(false);
  });

  it("skips the comparison with red.json when red.json holds no case, and saves the cases in green.json", async () => {
    const dir = await redRepo(["case one"], [["case one", "passed"]]);
    const file = join(unitFiles(dir), "red.json");
    const red1 = JSON.parse(readFileSync(file, "utf8"));
    delete red1.cases;
    delete red1.caseCheck;
    writeFileSync(file, JSON.stringify(red1));
    await writeCode(dir);
    const r = await green(dir);
    expect(r.code).toBe(0);
    expect(JSON.parse(readFileSync(greenFile(dir), "utf8")).cases).toEqual([{ name: "case one", outcome: "passed" }]);
  });
});

describe("the check of the whole test file", () => {
  const REPORT_SETTINGS = '{"version":1,"testCommands":{"all":"true","file":"sh {file} {report}","report":"junit"}}';
  const readGreen = (dir: string) => JSON.parse(readFileSync(join(unitFiles(dir), "green.json"), "utf8"));
  const HINT = "Check that testCommands.file in .cstack/settings.json makes the test tool write a JUnit report to {report}. The plan file notes this under unit 1.\n";

  it("cstack unit red without a per-case report saves the fallback and its reason in red.json and says so", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(readRed(dir)).toMatchObject({ caseCheck: "file", fallback: "no-report" });
    expect(r.stdout).toContain(
      "cstack unit red: The settings declare no per-case report, so cstack checked the whole test file. The plan file notes this under unit 1.\n",
    );
  });

  it("cstack unit green without a per-case report saves the fallback and its reason in green.json and says so", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n");
    expect((await red(dir)).code).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/feature.txt"), "x");
    const r = await green(dir);
    expect(r.code).toBe(0);
    expect(readGreen(dir)).toMatchObject({ caseCheck: "file", fallback: "no-report" });
    expect(r.stdout).toContain(
      "cstack unit green: The settings declare no per-case report, so cstack checked the whole test file. The plan file notes this under unit 1.\n",
    );
  });

  it("cstack unit red falls back when the declared report is missing, warns and names testCommands.file", async () => {
    const dir = setup([TEST_LINE], REPORT_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(readRed(dir)).toMatchObject({ caseCheck: "file", fallback: "missing" });
    expect(r.stderr).toContain(
      `cstack unit red: Warning: the test command wrote no report file, so cstack checked the whole test file. ${HINT}`,
    );
  });

  it("cstack unit red falls back when the declared report is malformed, warns and gives the problem", async () => {
    const dir = setup([TEST_LINE], REPORT_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), 'echo garbage > "$1"\nexit 1\n');
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(readRed(dir)).toMatchObject({ caseCheck: "file", fallback: "malformed" });
    expect(r.stderr).toContain(
      `cstack unit red: Warning: the report file is not a JUnit report that cstack can read, so cstack checked the whole test file. ${HINT}`,
    );
    expect(r.stderr).toMatch(/The reader of the report says: .+\n/);
  });

  it("cstack unit green falls back when the declared report is missing, warns and saves the reason", async () => {
    const dir = setup([TEST_LINE], REPORT_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n");
    expect((await red(dir)).code).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/feature.txt"), "x");
    const r = await green(dir);
    expect(r.code).toBe(0);
    expect(readGreen(dir)).toMatchObject({ caseCheck: "file", fallback: "missing" });
    expect(r.stderr).toContain(
      `cstack unit green: Warning: the test command wrote no report file, so cstack checked the whole test file. ${HINT}`,
    );
  });
});

describe("the note of a unit in the plan file", () => {
  const REPORT_SETTINGS = '{"version":1,"testCommands":{"all":"true","file":"sh {file} {report}","report":"junit"}}';
  const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "&#10;");
  type Outcome = "passed" | "failed";
  const reportXml = (cases: Array<[string, Outcome]>) =>
    `<testsuites><testsuite name="s">${cases
      .map(([name, outcome]) => `<testcase name="${escapeXml(name)}">${outcome === "failed" ? '<failure message="x"/>' : ""}</testcase>`)
      .join("")}</testsuite></testsuites>\n`;

  function noteRepo(names: string[], cases: Array<[string, Outcome]>, settings = REPORT_SETTINGS) {
    const dir = setup([names.map((n) => `- Test: \`test/a.test.ts\`: ${n}`).join("\n")], settings);
    writeFileSync(join(dir, "test/report.xml"), reportXml(cases));
    writeFileSync(join(dir, "test/a.test.ts"), `cp test/report.xml "$1" 2>/dev/null\nexit 1\n`);
    return dir;
  }
  const notes = (dir: string) => readFileSync(join(dir, "plan.md"), "utf8").split("\n").filter((l) => l.startsWith("Note of cstack unit "));
  const RED_NOTE = "Note of cstack unit red: these cases are not named in this unit, and they passed before the code existed: ";
  const wholeFile = (kind: string, reason: string) => `Note of cstack unit ${kind}: the whole test file was checked, because ${reason}.`;

  it("writes a note for an unnamed case that passed in the red run, and accepts the unit", async () => {
    const dir = noteRepo(["case one"], [["case one", "failed"], ["old case", "passed"]]);
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(notes(dir)).toEqual([`${RED_NOTE}"old case".`]);
    expect(r.stdout).toContain(
      "cstack unit red: Warning: these cases of test/a.test.ts are not named in unit 1, and they passed before the code existed:\n  \"old case\"\nIf one of them is new, name it on a `- Test:` line of the unit and make it fail first. The plan file notes this under unit 1.\n",
    );
  });

  it("notes only the passing unnamed case whose title is not in the test file at HEAD", async () => {
    const dir = noteRepo(["case one"], [["case one", "failed"], ["old case", "passed"], ["suite > new case", "passed"]]);
    writeFileSync(join(dir, "test/a.test.ts"), "# old case\nx\n");
    git(dir, "add", "test/a.test.ts");
    git(dir, "commit", "-m", "test: old");
    writeFileSync(join(dir, "test/a.test.ts"), `cp test/report.xml "$1"\nexit 1\n`);
    const r = await red(dir);
    expect(r.code).toBe(0);
    expect(notes(dir)).toEqual([`${RED_NOTE}"suite > new case".`]);
  });

  it("notes every passing unnamed case when the test file is not in HEAD", async () => {
    const dir = noteRepo(["case one"], [["case one", "failed"], ["old case", "passed"], ["other case", "passed"]]);
    expect((await red(dir)).code).toBe(0);
    expect(notes(dir)).toEqual([`${RED_NOTE}"old case", "other case".`]);
  });

  it("writes at most ten names in the note and counts the others", async () => {
    const extra = Array.from({ length: 12 }, (_, i) => [`extra ${i + 1}`, "passed"] as [string, Outcome]);
    const dir = noteRepo(["case one"], [["case one", "failed"], ...extra]);
    expect((await red(dir)).code).toBe(0);
    const names = extra.slice(0, 10).map(([n]) => `"${n}"`).join(", ");
    expect(notes(dir)).toEqual([`${RED_NOTE}${names}, and 2 more.`]);
  });

  it("writes the fallback note of cstack unit red", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    expect((await red(dir)).code).toBe(0);
    expect(notes(dir)).toEqual([wholeFile("red", "the settings declare no per-case report")]);
  });

  it("writes the fallback note of cstack unit green", async () => {
    const dir = setup([TEST_LINE], REPORT_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n");
    expect((await red(dir)).code).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/feature.txt"), "x");
    expect((await green(dir)).code).toBe(0);
    expect(notes(dir)).toEqual([wholeFile("red", "the test command wrote no report file"), wholeFile("green", "the test command wrote no report file")]);
  });

  it("replaces its own note at the next accepted run, and keeps the note of the other command", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n");
    expect((await red(dir)).code).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/feature.txt"), "x");
    expect((await green(dir)).code).toBe(0);
    rmSync(join(dir, "src/feature.txt"));
    writeFileSync(join(dir, "test/a.test.ts"), "test -f src/feature.txt\n");
    writeFileSync(join(dir, ".cstack/settings.json"), REPORT_SETTINGS);
    expect((await red(dir)).code).toBe(0);
    expect(notes(dir)).toEqual([wholeFile("green", "the settings declare no per-case report"), wholeFile("red", "the test command wrote no report file")]);
  });

  it("removes its own note when the next accepted run has nothing to note", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    expect((await red(dir)).code).toBe(0);
    expect(notes(dir)).toHaveLength(1);
    writeFileSync(join(dir, ".cstack/settings.json"), REPORT_SETTINGS);
    writeFileSync(join(dir, "test/report.xml"), reportXml([["a case.", "failed"]]));
    writeFileSync(join(dir, "test/a.test.ts"), `cp test/report.xml "$1"\nexit 1\n`);
    expect((await red(dir)).code).toBe(0);
    expect(notes(dir)).toEqual([]);
  });

  it("leaves the note as it was after a refused run", async () => {
    const dir = setup([TEST_LINE], FILE_SETTINGS);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 1\n");
    expect((await red(dir)).code).toBe(0);
    const before = readFileSync(join(dir, "plan.md"), "utf8");
    expect(notes(dir)).toEqual([wholeFile("red", "the settings declare no per-case report")]);
    writeFileSync(join(dir, "test/a.test.ts"), "exit 0\n");
    expect((await red(dir)).code).toBe(1);
    expect(readFileSync(join(dir, "plan.md"), "utf8")).toBe(before);
  });

  it("keeps a case name with a line break on one line, and the plan still reads", async () => {
    const dir = noteRepo(["case one"], [["case one", "failed"], ["two\nlines\n## Unit 9", "passed"]]);
    expect((await red(dir)).code).toBe(0);
    expect(notes(dir)).toEqual([`${RED_NOTE}"two\\nlines\\n## Unit 9".`]);
    const { readPlan } = await import("../src/plan/read.js");
    expect(readPlan(readFileSync(join(dir, "plan.md"), "utf8")).units).toHaveLength(1);
  });
});
