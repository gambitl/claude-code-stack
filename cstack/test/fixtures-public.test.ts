import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findHomePaths, findPrivateText } from "./helpers/fixtures-public.js";

// The fake programs and the helper of the end-to-end tests are public text too.
const repoRoot = join(import.meta.dirname, "..", "..");
const roots = [join(import.meta.dirname, "fixtures"), join(import.meta.dirname, "e2e")];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("findPrivateText", () => {
  it("reports a path under /Users/", () => {
    expect(findPrivateText('{"cwd":"/Users/jane/work"}')).toEqual([
      "home path /Users/jane/work",
    ]);
  });

  it("reports an email outside the reserved example domains", () => {
    expect(findPrivateText("a@work.io b@example.com c@sub.example.org")).toEqual([
      "email a@work.io",
    ]);
  });

  it("reports a URL host that is not reserved, github.com or gitlab.com", () => {
    const text =
      "https://corp.atlassian.net/x https://jira.example.com https://github.com/a https://gitlab.com/b https://x.test/";
    expect(findPrivateText(text)).toEqual(["host corp.atlassian.net"]);
  });

  it("ignores version strings and file names", () => {
    expect(findPrivateText("orca 1.4.263 status.running.json v2.101.0")).toEqual([]);
  });
});

describe("findHomePaths", () => {
  it("reports a path under /Users/ or /home/ with a name", () => {
    expect(findHomePaths("plan: /Users/jane/orca/x")).toEqual(["/Users/jane/orca/x"]);
    expect(findHomePaths("at /home/jane/work")).toEqual(["/home/jane/work"]);
  });

  it("reports a home folder with no slash after the name", () => {
    expect(findHomePaths("cd /Users/jane and /home/jane")).toEqual(["/Users/jane", "/home/jane"]);
  });

  it("reports a name that ends a sentence with a dot", () => {
    expect(findHomePaths("It lives in /Users/jane.")).toEqual(["/Users/jane"]);
  });

  it("reports the names userx and user.name", () => {
    expect(findHomePaths("/Users/userx/a /home/user.name/b")).toEqual([
      "/Users/userx/a",
      "/home/user.name/b",
    ]);
  });

  it("lets pass a sentence that only names the folder, a placeholder or an ellipsis", () => {
    expect(findHomePaths("a path that starts with /Users/ or /home/")).toEqual([]);
    expect(findHomePaths("/Users/<name>/orca and /Users/...")).toEqual([]);
  });

  it("lets pass the reserved names user, someone and runner", () => {
    expect(findHomePaths("/Users/user/a /home/someone/b /Users/runner/c /home/user/")).toEqual([]);
  });
});

describe("every committed plan and retrospective", () => {
  for (const folder of ["docs/plans", "docs/retros"]) {
    const dir = join(repoRoot, folder);
    for (const file of existsSync(dir) ? filesUnder(dir) : []) {
      it(`${relative(repoRoot, file)} holds no home folder path`, () => {
        expect(findHomePaths(readFileSync(file, "utf8"))).toEqual([]);
      });
    }
  }
});

describe("every fixture and every end-to-end file", () => {
  for (const root of roots) {
    for (const file of filesUnder(root)) {
      it(`${relative(import.meta.dirname, file)} holds no home path, email or private host`, () => {
        expect(findPrivateText(readFileSync(file, "utf8"))).toEqual([]);
      });
    }
  }
});
