import { ORCA_HINT, checkOrca } from "./orca.js";
import type { Runner } from "../orca/run.js";

// Everything doctor needs from the outside world. Tests pass their own.
export type DoctorInput = {
  run: Runner;
  timeoutMs: number;
  nodeVersion: string;
  enginesNode: string;
  findOnPath: (command: string) => string | undefined;
};

export type Outcome = { ok: boolean; text: string };

export type Requirement = {
  name: string;
  required: boolean;
  install: string;
  check: (input: DoctorInput, install: string) => Promise<Outcome>;
};

const NODE_HINT =
  "Install the current long-term support release from https://nodejs.org.";
const FORGE_HINT =
  'Install one with "brew install gh" for GitHub or "brew install glab" for GitLab.';

const seconds = (input: DoctorInput) => `${Math.round(input.timeoutMs / 1000)}`;

// The text of an answer that is not a version: missing, failed or late.
function problem(
  result: Exclude<Awaited<ReturnType<Runner>>, { kind: "ok" }>,
  input: DoctorInput,
  install: string,
): string {
  if (result.kind === "missing") return `missing. ${install}`;
  if (result.kind === "timeout")
    return `did not answer within ${seconds(input)} seconds`;
  if (result.kind === "too-large") return "gave more output than cstack reads";
  return `failed with exit code ${result.exitCode}`;
}

function parse(stdout: string, pattern: RegExp): string {
  return pattern.exec(stdout)?.[1] ?? "present, version unknown";
}

// A simple item is data: a command, its arguments and a pattern that finds the version.
function simple(
  name: string,
  required: boolean,
  command: string,
  args: string[],
  pattern: RegExp,
  install: string,
): Requirement {
  return {
    name,
    required,
    install,
    check: async (input, hint) => {
      const result = await input.run(command, args);
      if (result.kind !== "ok")
        return { ok: false, text: problem(result, input, hint) };
      return { ok: true, text: parse(result.stdout, pattern) };
    },
  };
}

const ENGINES = /^>=(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

function parts(version: string): number[] {
  return version.split(".").map(Number);
}

// Understands only ">=major", ">=major.minor" and ">=major.minor.patch".
export function nodeIsTooOld(running: string, enginesNode: string): boolean {
  const match = ENGINES.exec(enginesNode);
  if (!match)
    throw new Error(`engines.node has a form doctor cannot read: ${enginesNode}`);
  const minimum = [match[1], match[2] ?? "0", match[3] ?? "0"].map(Number);
  const have = parts(running);
  for (let i = 0; i < 3; i++) {
    const a = have[i] ?? 0;
    if (a !== minimum[i]) return a < minimum[i];
  }
  return false;
}

const node: Requirement = {
  name: "Node",
  required: true,
  install: NODE_HINT,
  check: async (input, hint) => {
    if (nodeIsTooOld(input.nodeVersion, input.enginesNode))
      return {
        ok: false,
        text: `${input.nodeVersion} is too old. cstack needs ${input.enginesNode}. ${hint}`,
      };
    return { ok: true, text: input.nodeVersion };
  },
};

const git: Requirement = {
  name: "git",
  required: true,
  install: 'Run "xcode-select --install".',
  check: async (input, hint) => {
    // Without the developer tools, /usr/bin/git opens a system window. Doctor must only read.
    const tools = await input.run("xcode-select", ["-p"]);
    if (tools.kind !== "ok" && input.findOnPath("git") === "/usr/bin/git")
      return { ok: false, text: `missing. ${hint}` };
    const result = await input.run("git", ["--version"]);
    if (result.kind !== "ok")
      return { ok: false, text: problem(result, input, hint) };
    return { ok: true, text: parse(result.stdout, /git version (\S+)/) };
  },
};

const forge: Requirement = {
  name: "Forge client",
  required: true,
  install: FORGE_HINT,
  check: async (input, hint) => {
    const clients: [string, RegExp][] = [
      ["gh", /gh version (\S+)/],
      ["glab", /glab (\S+)/],
    ];
    const texts: string[] = [];
    let ok = false;
    for (const [command, pattern] of clients) {
      const result = await input.run(command, ["--version"]);
      if (result.kind === "ok") {
        ok = true;
        texts.push(`${command} ${parse(result.stdout, pattern)}`);
      } else {
        const why = result.kind === "missing" ? "missing" : problem(result, input, "");
        texts.push(`${command} ${why}`);
      }
    }
    return { ok, text: ok ? texts.join(", ") : `${texts.join(", ")}. ${hint}` };
  },
};

export const requirements: Requirement[] = [
  simple(
    "macOS",
    true,
    "sw_vers",
    ["-productVersion"],
    /^\s*(\S+)/,
    "cstack runs only on macOS.",
  ),
  node,
  git,
  forge,
  simple(
    "Claude Code",
    true,
    "claude",
    ["--version"],
    /^(\S+) \(Claude Code\)/,
    'Install it with "curl -fsSL https://claude.ai/install.sh | bash".',
  ),
  {
    name: "Orca",
    required: false,
    install: ORCA_HINT,
    check: checkOrca,
  },
];
