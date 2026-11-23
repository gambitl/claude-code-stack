export const STEP_KINDS = ["command", "helper", "action"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const CONDITIONS = [
  "each-unit",
  "each-unit-with-test",
  "each-stuck-unit",
  "each-negative-criterion",
  "each-dependent-ticket",
  "user-interface",
  "new-structural-decision",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export type Step =
  | { line: number; kind: "command"; command: string; condition?: Condition }
  | { line: number; kind: "helper"; helper: string; word?: string; condition?: Condition }
  | { line: number; kind: "action"; action: string; condition?: Condition };

export type StepsResult = { ok: true; steps: Step[] } | { ok: false; message: string };

const OPENING = "<!-- mandatory steps";
const CLOSING = "-->";
const KEBAB = /^[a-z0-9][a-z0-9-]*$/;
const HELPER = /^([a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*)(?: ([a-z0-9][a-z0-9-]*))?$/;

class Refusal extends Error {}

function refuse(name: string, line: number, rule: string): never {
  throw new Refusal(`${name}, line ${line}: ${rule}`);
}

function parseStep(raw: string, line: number, name: string): Step {
  const colon = raw.indexOf(": ");
  if (colon === -1) {
    refuse(name, line, 'a step must be written "<kind>: <text>", with a colon and a space after its kind.');
  }
  const kind = raw.slice(0, colon);
  if (!(STEP_KINDS as readonly string[]).includes(kind)) {
    refuse(name, line, `the kind "${kind}" is unknown. Use one of: ${STEP_KINDS.join(", ")}.`);
  }
  const parts = raw.slice(colon + 2).split(" | ");
  if (parts.length > 2) {
    refuse(name, line, 'a step may have only one condition, written after one " | ".');
  }
  const text = parts[0] ?? "";
  const condition = parts[1];
  if (condition !== undefined && !(CONDITIONS as readonly string[]).includes(condition)) {
    refuse(name, line, `the condition "${condition}" is unknown. Use one of: ${CONDITIONS.join(", ")}.`);
  }
  const extra = condition === undefined ? {} : { condition: condition as Condition };
  if (kind === "command") {
    if (!text.startsWith("cstack ") || text.length === "cstack ".length) {
      refuse(name, line, 'a command step must start with "cstack " and then name a command.');
    }
    return { line, kind, command: text, ...extra };
  }
  if (kind === "helper") {
    const match = HELPER.exec(text);
    if (match === null) {
      refuse(name, line, 'a helper step must be written "<skill>:<name>", with an optional word after one space. Each part is kebab-case.');
    }
    return { line, kind, helper: match[1] as string, ...(match[2] === undefined ? {} : { word: match[2] }), ...extra };
  }
  if (!KEBAB.test(text)) {
    refuse(name, line, "an action step must be one kebab-case id, such as approval-gate.");
  }
  return { line, kind: "action", action: text, ...extra };
}

export function readSteps(text: string, name: string): StepsResult {
  const lines = text.split("\n").map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
  if (lines[lines.length - 1] === "") lines.pop();
  try {
    if (lines[0] !== OPENING) {
      const stray = lines.findIndex((line) => line.startsWith(OPENING));
      if (stray !== -1) {
        refuse(name, stray + 1, 'the block of mandatory steps must open on line 1, with exactly "<!-- mandatory steps".');
      }
      return { ok: true, steps: [] };
    }
    const steps: Step[] = [];
    for (let index = 1; index < lines.length; index++) {
      const raw = lines[index] as string;
      const line = index + 1;
      if (raw === CLOSING) {
        if (steps.length === 0) {
          refuse(name, line, "the block of mandatory steps is empty. Write at least one step before the closing line.");
        }
        return { ok: true, steps };
      }
      if (raw === "") {
        refuse(name, line, "a blank line is not allowed inside the block of mandatory steps.");
      }
      if (raw.includes(CLOSING)) {
        refuse(name, line, 'the closing mark "-->" must be alone on its line.');
      }
      steps.push(parseStep(raw, line, name));
    }
    refuse(name, 1, 'the block of mandatory steps never closes. Its last line must be "-->".');
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, message: error.message };
    throw error;
  }
}

export type BlockFreeResult = { ok: true; text: string } | { ok: false; message: string };

/** The guide text without its block of mandatory steps and the empty line after the block. */
export function withoutBlock(text: string, name: string): BlockFreeResult {
  const checked = readSteps(text, name);
  if (!checked.ok) return checked;
  if (!text.startsWith(`${OPENING}\n`) && !text.startsWith(`${OPENING}\r\n`)) return { ok: true, text };
  const closing = text.search(/^-->\r?\n?/m);
  const after = text.slice(closing).replace(/^-->\r?\n?/, "");
  return { ok: true, text: after.replace(/^\r?\n/, "") };
}
