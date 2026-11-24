// The shared helper of the end-to-end tests without Orca. It compiles cstack once into a temporary folder, builds the environment of the
// child processes from scratch, and sets up a project with a bare remote and the fake `orca` and `gh` programs of test/e2e/bin.
// Nothing here reaches the real Orca, the real gh, the network or the real home folder.
import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { expect } from "vitest";
import { withoutBlock } from "../../src/guide-steps.js";

const CSTACK = join(import.meta.dirname, "..", "..");
const FIXTURES = join(import.meta.dirname, "..", "fixtures", "e2e-orca");
const PROJECT_FIXTURE = join(import.meta.dirname, "..", "fixtures", "e2e", "project");
const FAKES = join(import.meta.dirname, "bin");

export const PLAN = "docs/plans/e2e-orca.md";
const REMOTE_URL = "https://github.com/example-owner/example-repo.git";
const COMMAND_TIMEOUT_MS = 60_000;

export interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

export interface Call {
  program: string;
  args: string[];
  cwd?: string;
}

interface Options {
  input?: string;
  cwd?: string;
}

export interface Chain {
  /** The environment of every child process. It holds no ORCA_ variable. */
  env: NodeJS.ProcessEnv;
  temp: string;
  project: string;
  home: string;
  plan: string;
  /** Runs a program through the PATH of the environment. */
  exec(program: string, args: string[]): Result;
  /** Runs the built cstack. */
  run(args: string[], options?: Options): Result;
  /** Runs the built cstack after checking that the guide or prompt names the command. */
  follow(source: string, args: string[], options?: Options): Result;
  ghCalls(): Call[];
  /** The programs of the PATH folder. */
  pathPrograms(): string[];
  cleanup(): void;
}

function findOnPath(program: string): string {
  for (const folder of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(folder, program);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next folder.
    }
  }
  throw new Error(`${program} is not on the PATH of the test process.`);
}

export async function createChain(options: { orca: boolean; orcaMode?: "old" | "closed"; gh?: boolean }): Promise<Chain> {
  // The real path, so that the paths that cstack resolves are the paths that the tests compare with.
  const temp = realpathSync(mkdtempSync(join(tmpdir(), "cstack-e2e-orca-")));
  // The real cstack/dist is never used. The compiler writes into the temporary folder, next to links to the shipped files.
  execFileSync(join(CSTACK, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.build.json", "--outDir", join(temp, "dist")], { cwd: CSTACK, timeout: 170_000 });
  for (const name of ["guides", "skills", "package.json"]) symlinkSync(join(CSTACK, name), join(temp, name));
  const bin = join(temp, "dist", "bin.js");

  const home = join(temp, "home");
  const project = join(temp, "project");
  const bare = join(temp, "remote.git");
  const binDir = join(temp, "path");
  const fakeDir = join(temp, "fake");
  for (const dir of [home, project, binDir, fakeDir]) mkdirSync(dir);
  // WHY: the fakes are links, so that Node reads them as ES modules through the package.json of cstack, which says "type": "module".
  symlinkSync(process.execPath, join(binDir, "node"));
  symlinkSync(findOnPath("git"), join(binDir, "git"));
  if (options.gh !== false) symlinkSync(join(FAKES, "gh"), join(binDir, "gh"));
  if (options.orca) symlinkSync(join(FAKES, "orca"), join(binDir, "orca"));

  // The environment is built from scratch: nothing of the test process, and no ORCA_ variable, reaches a child.
  const env: NodeJS.ProcessEnv = {
    PATH: `${binDir}:/usr/bin:/bin`,
    HOME: home,
    TZ: "UTC",
    LANG: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_ALLOW_PROTOCOL: "file",
    TMPDIR: temp,
    E2E_FAKE_DIR: fakeDir,
    ...(options.orcaMode !== undefined ? { E2E_ORCA_MODE: options.orcaMode } : {}),
  };

  const git = (...args: string[]) => execFileSync("git", args, { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: COMMAND_TIMEOUT_MS }).trim();
  execFileSync("git", ["init", "--bare", "-b", "main", bare], { env, stdio: "ignore", timeout: COMMAND_TIMEOUT_MS });
  // WHY: the test files of the fixtures end in .fixture, so that Vitest does not run them as tests of cstack.
  cpSync(PROJECT_FIXTURE, project, { recursive: true });
  for (const name of ["add", "subtract"]) renameSync(join(project, "test", `${name}.test.js.fixture`), join(project, "test", `${name}.test.js`));
  git("init", "-b", "main");
  git("config", "user.name", "e2e");
  git("config", "user.email", "e2e@example.com");
  git("config", "commit.gpgsign", "false");
  git("remote", "add", "origin", REMOTE_URL);
  git("config", `url.${bare}.insteadOf`, REMOTE_URL);
  // The plan is on main.
  mkdirSync(join(project, "docs", "plans"), { recursive: true });
  cpSync(join(FIXTURES, "plan.md"), join(project, PLAN));
  git("add", ".");
  git("commit", "-m", "chore: start the project");
  git("push", "-u", "origin", "main");

  const run = (args: string[], o: Options = {}): Result => {
    const r = spawnSync(process.execPath, [bin, ...args], { cwd: o.cwd ?? project, env, input: o.input, encoding: "utf8", timeout: COMMAND_TIMEOUT_MS });
    return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
  };

  /** The command as a guide writes it: placeholders stand for the plan path, the unit, the helper id, the ticket key and the tracker name. */
  const written = (args: string[]): string => {
    const words = args.map((w) => (w === PLAN ? "<plan file>" : w));
    if (words[0] === "unit" && ["red", "green", "commit"].includes(words[1])) words[2] = "<n>";
    if (words[0] === "tracker") {
      words[2] = "'<key>'";
      words[words.indexOf("--tracker") + 1] = "<name>";
      const toAt = words.indexOf("--to");
      if (toAt >= 0) words[toAt + 1] = `"${words[toAt + 1]}"`;
      const fileAt = words.indexOf("--body-file");
      if (fileAt >= 0) words[fileAt + 1] = "<file>";
    }
    return `cstack ${words.join(" ")}`;
  };
  const check = (source: string, args: string[]) => {
    // A command that only the block of mandatory steps names does not count.
    const prose = withoutBlock(source, "the text that names the command");
    if (!prose.ok) throw new Error(prose.message);
    expect(prose.text, `no text names "${written(args)}"`).toContain(written(args));
  };

  const calls = (program: string): Call[] =>
    (existsSync(join(fakeDir, "calls.log")) ? readFileSync(join(fakeDir, "calls.log"), "utf8") : "")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Call)
      .filter((c) => c.program === program);
  return {
    env,
    temp,
    project,
    home,
    plan: PLAN,
    exec(program, args) {
      const r = spawnSync(program, args, { cwd: project, env, encoding: "utf8", timeout: COMMAND_TIMEOUT_MS });
      return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
    },
    run,
    follow(source, args, o) {
      check(source, args);
      return run(args, o);
    },
    ghCalls: () => calls("gh"),
    pathPrograms: () => readdirSync(binDir).sort(),
    cleanup() {
      rmSync(temp, { recursive: true, force: true });
    },
  };
}
