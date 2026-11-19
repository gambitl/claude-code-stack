import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findPrivateText } from "./helpers/fixtures-public.js";

const root = join(import.meta.dirname, "fixtures");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("findPrivateText", () => {
  it("reports a path under /Users/", () => {
    expect(findPrivateText('{"cwd":"/Users/someone/work"}')).toEqual([
      "home path /Users/someone/work",
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

describe("every fixture", () => {
  for (const file of filesUnder(root)) {
    it(`${relative(root, file)} holds no home path, email or private host`, () => {
      expect(findPrivateText(readFileSync(file, "utf8"))).toEqual([]);
    });
  }
});
