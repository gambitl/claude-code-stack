import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { unitOrder } from "../src/commands/unit-order.js";
import type { Io } from "../src/io.js";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" },
  ).trim();

const approved = readFileSync(new URL("./fixtures/plans/approved.md", import.meta.url), "utf8");

interface U {
  files: string[];
  dependsOn?: number[];
  blocked?: string;
}

function planText(units: U[]): string {
  const head = approved.slice(0, approved.indexOf("## Implementation units"));
  const tail = approved.slice(approved.indexOf("## Documentation duties"));
  const body = units
    .map(
      (u, i) =>
        `### Unit ${i + 1}: Thing ${i + 1}\n- Files: ${u.files.map((f) => `\`${f}\``).join(", ")}\n- No test: prose only.\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: \`feat(cli): add ${i + 1}\`\n- Depends on: ${u.dependsOn?.join(", ") ?? "none"}\n${u.blocked ? `- Blocked: ${u.blocked}\n` : ""}`,
    )
    .join("\n");
  return `${head}## Implementation units\n\n${body}\n${tail}`;
}

function setup(units: U[] | string) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "cstack-order-")));
  made.push(dir);
  git(dir, "init", "-b", "main");
  writeFileSync(join(dir, "start.txt"), "x");
  git(dir, "add", ".");
  git(dir, "commit", "-m", "chore: start");
  git(dir, "switch", "-c", "feature");
  writeFileSync(join(dir, "plan.md"), typeof units === "string" ? units : planText(units));
  return dir;
}

const commitUnit = (dir: string, n: number) => {
  writeFileSync(join(dir, `f${n}.txt`), "x");
  git(dir, "add", ".");
  git(dir, "commit", "-m", `feat(cli): add ${n}\n\nCstack-Unit: ${n}`);
};

async function order(dir: string, ...args: string[]) {
  const out = { stdout: "", stderr: "" };
  const io: Io = { stdout: (t) => (out.stdout += t), stderr: (t) => (out.stderr += t) };
  const code = await unitOrder(["--plan", "plan.md", ...args], io, dir);
  return { code, ...out };
}

const shared: U[] = [{ files: ["src/a.ts"] }, { files: ["src/a.ts"] }, { files: ["src/b.ts"] }];

describe("cstack unit order", () => {
  it("prints the batches and why a unit waits", async () => {
    const r = await order(setup(shared));
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(
      "Batch 1: units 1, 3\nBatch 2: unit 2\nUnit 2 waits: it shares `src/a.ts` with unit 1.\n",
    );
  });

  it("lists a unit with a Cstack-Unit commit as already committed", async () => {
    const dir = setup(shared);
    commitUnit(dir, 1);
    const r = await order(dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Batch 1: units 2, 3");
    expect(r.stdout).toContain("Unit 1 already has a commit.");
  });

  it("prints the order as one JSON line with --json", async () => {
    const dir = setup(shared);
    commitUnit(dir, 3);
    const r = await order(dir, "--json");
    expect(r.stdout.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(r.stdout)).toEqual({
      batches: [[1], [2]],
      waits: [{ unit: 2, reason: "it shares `src/a.ts` with unit 1" }],
      setAside: [],
      committed: [3],
    });
  });

  it("sets aside a blocked unit and prints the reason", async () => {
    const r = await order(setup([{ files: ["a"], blocked: "waiting for the design." }, { files: ["b"], dependsOn: [1] }]));
    expect(r.stdout).toContain("No unit is left to run.");
    expect(r.stdout).toContain("Unit 1 is set aside: it is blocked: waiting for the design.");
    expect(r.stdout).toContain("Unit 2 is set aside: it depends on unit 1, which is set aside.");
    expect(r.code).toBe(0);
  });

  it("exits with 1 and names both units of a cycle", async () => {
    const r = await order(setup([{ files: ["a"], dependsOn: [2] }, { files: ["b"], dependsOn: [1] }]), "--json");
    expect(r.code).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("unit 1 depends on unit 2, and unit 2 depends on unit 1");
  });

  it("exits with 3 for an invalid plan file", async () => {
    const r = await order(setup("not a plan\n"));
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("cstack unit order:");
  });

  it("says that no unit is left when every unit is committed", async () => {
    const dir = setup([{ files: ["a"] }, { files: ["b"] }]);
    commitUnit(dir, 1);
    commitUnit(dir, 2);
    const r = await order(dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("No unit is left to run.");
    expect(r.stdout).toContain("Units 1, 2 already have a commit.");
  });

  it("exits with 2 for an unknown flag", async () => {
    const r = await order(setup(shared), "--nope");
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage: cstack unit order");
  });
});
