import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

/** Phrases whose value the settings file owns. */
const OWNED = [
  "in English",
  "Co-Authored-By",
  "npm test",
  "npm run test",
  "yarn test",
  "pnpm test",
  "vitest run",
  "pytest",
  "go test",
  "cargo test",
  "mvn test",
  "gradle test",
  "make test",
];

function filesUnder(dir: string, skip: (path: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (skip(path)) return [];
    return e.isDirectory() ? filesUnder(path, skip) : [path];
  });
}

/** Every owned phrase, and every "rebase" without "integration", with its file. */
export function scan(folders: string[], base: string, skip: (path: string) => boolean = () => false): string[] {
  const failures: string[] = [];
  for (const file of folders.flatMap((f) => filesUnder(f, skip))) {
    const text = readFileSync(file, "utf8");
    const lower = text.toLowerCase();
    const name = relative(base, file);
    for (const phrase of OWNED) {
      if (lower.includes(phrase.toLowerCase())) failures.push(`${name}: "${phrase}" belongs to the settings file`);
    }
    if (/\brebas\w*/i.test(text) && !/`integration`|\bintegration setting\b/i.test(text)) {
      failures.push(`${name}: "rebase" without the integration setting`);
    }
  }
  return failures;
}

describe("settings values stay in the settings file", () => {
  it("reports a fixture guide that says 'in English'", () => {
    const folder = join(here, "..", "fixtures", "guides", "owned-value");
    const failures = scan([folder], folder);
    expect(failures).toContain('plan.md: "in English" belongs to the settings file');
    expect(failures).toContain('plan.md: "rebase" without the integration setting');
  });

  it("finds no owned value in the real skill and guides", () => {
    // Match on the path inside the package, so a parent folder of the checkout never skips everything.
    const skip = (path: string) => {
      const parts = relative(root, path).split(sep);
      return parts.includes("templates") || parts.at(-1) === "settled-decisions.md";
    };
    const folders = [
      join(root, "guides", "resolve-issue"),
      join(root, "skills", "resolve-issue"),
    ];
    expect(scan(folders, root, skip)).toEqual([]);
  });

  it("makes the entry skill point to the settings", () => {
    const text = readFileSync(join(root, "skills", "resolve-issue", "SKILL.md"), "utf8");
    expect(text).toContain(".cstack/settings.json");
    expect(text).toContain("cstack next");
    expect(text).toContain("win over");
  });
});
