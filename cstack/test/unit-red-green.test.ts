import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
