import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import { guide, readGuide } from "../src/commands/guide.js";
import type { Io } from "../src/io.js";

function collect() {
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (text) => {
      out.stdout += text;
    },
    stderr: (text) => {
      out.stderr += text;
    },
  };
  return { out, io };
}

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const missingRoot = "/nonexistent/cstack-package-root";

describe("guide", () => {
  it("prints the guide file byte for byte", async () => {
    const { out, io } = collect();
    const code = await run(["guide", "hello", "--skill", "cstack-example"], io);
    const expected = readFileSync(
      new URL("../guides/cstack-example/hello.md", import.meta.url),
      "utf8",
    );
    expect(out.stdout).toBe(expected);
    expect(out.stderr).toBe("");
    expect(code).toBe(0);
  });

  it("lists the known phases for an unknown phase", async () => {
    const { out, io } = collect();
    const code = await guide(["nope", "--skill", "cstack-example"], io, { packageRoot });
    expect(code).toBe(1);
    expect(out.stdout).toBe("");
    expect(out.stderr).toContain("hello");
  });

  it("lists the skills that have guides when the default skill has none", async () => {
    // The real package has guides for resolve-issue, so this case uses a package that has none.
    const root = mkdtempSync(join(tmpdir(), "cstack-guide-"));
    try {
      mkdirSync(join(root, "guides", "cstack-example"), { recursive: true });
      writeFileSync(join(root, "guides", "cstack-example", "hello.md"), "# Hello\n");
      const { out, io } = collect();
      const code = await guide(["hello"], io, { packageRoot: root });
      expect(code).toBe(1);
      expect(out.stderr).toContain("cstack-example");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists the skills that have guides when the skill has none", async () => {
    const { out, io } = collect();
    const code = await guide(["hello", "--skill", "no-such-skill"], io, { packageRoot });
    expect(code).toBe(1);
    expect(out.stderr).toContain("cstack-example");
  });

  it("refuses a path as phase or skill before reading any file", async () => {
    for (const args of [
      ["../../etc/passwd"],
      ["hello", "--skill", "../../etc/passwd"],
    ]) {
      const { out, io } = collect();
      const code = await guide(args, io, { packageRoot: missingRoot });
      expect(code).toBe(2);
      expect(out.stdout).toBe("");
      expect(out.stderr).toContain("Usage:");
    }
  });

  it("refuses a missing phase, an extra argument and an unknown option", async () => {
    for (const args of [[], ["hello", "extra"], ["hello", "--bogus"]]) {
      const { io } = collect();
      expect(await guide(args, io, { packageRoot })).toBe(2);
    }
  });
});

describe("guide with a block of mandatory steps", () => {
  const blockRoot = fileURLToPath(new URL("./fixtures/steps-block", import.meta.url));

  it("prints the text that follows the block and the empty line after it", async () => {
    const { out, io } = collect();
    const code = await guide(["build"], io, { packageRoot: blockRoot });
    const fixture = readFileSync(join(blockRoot, "guides/resolve-issue/build.md"), "utf8");
    const expected = fixture.slice(fixture.indexOf("-->\n\n") + "-->\n\n".length);
    expect(out.stdout).toBe(expected);
    expect(out.stderr).toBe("");
    expect(code).toBe(0);
  });

  it("exits with 3 and names the guide and line 1 when the block never closes", async () => {
    const root = mkdtempSync(join(tmpdir(), "cstack-guide-"));
    try {
      mkdirSync(join(root, "guides", "resolve-issue"), { recursive: true });
      writeFileSync(join(root, "guides", "resolve-issue", "build.md"), "<!-- mandatory steps\ncommand: cstack next\n");
      const { out, io } = collect();
      const code = await guide(["build"], io, { packageRoot: root });
      expect(code).toBe(3);
      expect(out.stdout).toBe("");
      expect(out.stderr).toContain("guides/resolve-issue/build.md");
      expect(out.stderr).toContain("line 1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("readGuide", () => {
  function fixtureRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "cstack-readguide-"));
    mkdirSync(join(root, "guides", "resolve-issue"), { recursive: true });
    writeFileSync(join(root, "guides", "resolve-issue", "ticket.md"), "# Ticket\r\nbytes é\n");
    return root;
  }

  it("returns the exact bytes of the guide file", () => {
    const root = fixtureRoot();
    try {
      expect(readGuide(root, "resolve-issue", "ticket")).toEqual({
        ok: true,
        text: "# Ticket\r\nbytes é\n",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists the known phases for an unknown phase", () => {
    const root = fixtureRoot();
    try {
      const result = readGuide(root, "resolve-issue", "nope");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("Known phases: ticket");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists the skills with guides for an unknown skill", () => {
    const root = fixtureRoot();
    try {
      const result = readGuide(root, "other", "ticket");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("Skills with guides: resolve-issue");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
