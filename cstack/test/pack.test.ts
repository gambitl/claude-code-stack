import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);

test("npm pack lists the build, the skills and the guides", async () => {
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
    "skills/resolve-issue/agents/code-architect.md",
    "skills/resolve-issue/agents/code-explorer.md",
    "skills/resolve-issue/agents/code-reviewer.md",
    "skills/resolve-issue/agents/code-reviewer-deep.md",
    "skills/resolve-issue/agents/code-reviewer-simplicity.md",
    "skills/resolve-issue/agents/cto-review.md",
    "skills/resolve-issue/agents/executor.md",
    "skills/resolve-issue/agents/implementer.md",
    "skills/resolve-issue/agents/implementer-escalation.md",
    "skills/resolve-issue/agents/pr-reviewer.md",
    "skills/resolve-issue/.claude-plugin/plugin.json",
    "skills/resolve-issue/templates/retro.md",
    "skills/resolve-issue/templates/tracker-file.json",
    "guides/resolve-issue/build.md",
    "guides/resolve-issue/review.md",
    "guides/resolve-issue/independent-review.md",
    "guides/resolve-issue/update-branch.md",
    "guides/resolve-issue/document.md",
    "guides/resolve-issue/briefing.md",
    "guides/resolve-issue/after-build-questions.md",
    "guides/resolve-issue/ready.md",
    "guides/resolve-issue/retro.md",
    "guides/resolve-issue/publish.md",
    "skills/resolve-issue/SKILL.md",
    "skills/resolve-issue/writing.md",
    "skills/resolve-issue/settled-decisions.md",
    "guides/resolve-issue/ticket.md",
    "guides/resolve-issue/dependencies.md",
    "guides/resolve-issue/code-map.md",
    "guides/resolve-issue/questions.md",
    "guides/resolve-issue/plan.md",
  ]) {
    expect(paths).toContain(p);
  }
}, 120_000);
