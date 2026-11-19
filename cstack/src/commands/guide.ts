import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";

const USAGE = "Usage: cstack guide <phase> [--skill <name>]\n";
const NAME = /^[a-z0-9][a-z0-9-]*$/;

function usageError(io: Io, problem: string): number {
  io.stderr(`cstack: ${problem}\n${USAGE}`);
  return 2;
}

function listDir(path: string): string[] | undefined {
  try {
    return readdirSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export type GuideResult = { ok: true; text: string } | { ok: false; message: string };

export function readGuide(packageRoot: string, skill: string, phase: string): GuideResult {
  const guides = join(packageRoot, "guides");
  const phases = listDir(join(guides, skill));
  if (phases === undefined) {
    const skills = (listDir(guides) ?? []).sort().join(", ");
    return {
      ok: false,
      message: `cstack: this version of cstack has no guides for the skill "${skill}".\nSkills with guides: ${skills}\n`,
    };
  }
  if (!phases.includes(`${phase}.md`)) {
    const known = phases
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.slice(0, -3))
      .sort()
      .join(", ");
    return {
      ok: false,
      message: `cstack: unknown phase "${phase}" for the skill "${skill}".\nKnown phases: ${known}\n`,
    };
  }
  return { ok: true, text: readFileSync(join(guides, skill, `${phase}.md`), "utf8") };
}

export function guide(args: string[], io: Io, options: { packageRoot: string }): number {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { skill: { type: "string" } },
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    return usageError(io, error instanceof Error ? error.message : String(error));
  }
  const [phase, ...extra] = parsed.positionals;
  const skill = parsed.values.skill ?? "resolve-issue";
  if (phase === undefined) return usageError(io, "no phase given");
  if (extra.length > 0) return usageError(io, `unexpected argument "${extra[0]}"`);
  if (!NAME.test(phase)) return usageError(io, `bad phase name "${phase}"`);
  if (!NAME.test(skill)) return usageError(io, `bad skill name "${skill}"`);

  const result = readGuide(options.packageRoot, skill, phase);
  if (!result.ok) {
    io.stderr(result.message);
    return 1;
  }
  io.stdout(result.text);
  return 0;
}
