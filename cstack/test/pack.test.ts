import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);

test("npm pack lists the build, the example skill and the example guide", async () => {
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const { stdout } = await run("npm", ["pack", "--dry-run", "--json"], {
    cwd: new URL("..", import.meta.url),
    timeout: 120_000,
  });
  const [pack] = JSON.parse(stdout);
  expect(pack.filename).toBe(`gambitl-cstack-${version}.tgz`);
  const paths = pack.files.map((f: { path: string }) => f.path);
  for (const p of [
    "dist/bin.js",
    "dist/cli.js",
    "skills/cstack-example/SKILL.md",
    "skills/cstack-example/.claude-plugin/plugin.json",
    "skills/cstack-example/agents/check.md",
    "guides/cstack-example/hello.md",
  ]) {
    expect(paths).toContain(p);
  }
}, 120_000);
