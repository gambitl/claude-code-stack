import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import { guide } from "../src/commands/guide.js";
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
