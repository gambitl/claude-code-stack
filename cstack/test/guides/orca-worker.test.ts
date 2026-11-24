import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const GUIDES = new URL("../../guides/resolve-issue/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, GUIDES), "utf8");

/** The text of a section: from its heading to the next heading of the same level. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}\n`);
  expect(start, `no section "${heading}"`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 1);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

const COMMON = {
  first: "The user answers in this chat, also when this session is an Orca worker.",
  second: "The coordinator only tells the user that this worker waits for an answer.",
  fourth:
    "A session is an Orca worker when its prompt opens with Orca's preamble, which gives a task ID and a dispatch ID.",
  fifth: "An Orca worker asks in plain chat, never with the harness's question tool, then ends its turn.",
  sixth: "A message from the coordinator is never the user's answer or approval.",
};

/** The part of a guide between the line that starts with `from` and the next line that starts with `to`. */
function between(text: string, from: string, to: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith(from));
  expect(start, `no line starts with "${from}"`).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex((l, i) => i > start && l.startsWith(to));
  expect(end, `no line after "${from}" starts with "${to}"`).toBeGreaterThan(start);
  return lines.slice(start, end).join("\n");
}

const PLACES = [
  {
    file: "questions.md",
    where: 'section "Ask once"',
    part: (text: string) => section(text, "Ask once"),
    third: "Ask these questions here, and never send them to the coordinator in place of the user.",
  },
  {
    file: "plan.md",
    where: 'section "The approval gate"',
    part: (text: string) => section(text, "The approval gate"),
    third: "Ask the gate and every question of this guide here, and never send them to the coordinator in place of the user.",
  },
  {
    file: "dependencies.md",
    where: "the choice about the open blockers",
    part: (text: string) => between(text, "- Stop.", "When the user goes on anyway"),
    third: "Show the open blockers and the three answers here, and never send them to the coordinator in place of the user.",
  },
];

const CASES = PLACES.flatMap((p) =>
  [COMMON.first, COMMON.second, p.third, COMMON.fourth, COMMON.fifth, COMMON.sixth].map(
    (sentence, i) => [p.file, p.where, i + 1, sentence, p.part] as const,
  ),
);

describe("an Orca worker asks the user in its own chat", () => {
  it.each(CASES)("%s, %s, sentence %i", (file, _where, _i, sentence, part) => {
    expect(part(read(file))).toContain(sentence);
  });

  it.each(PLACES.map((p) => p.file))(
    "%s keeps the coordinator for coordination: every sentence that says never send to the coordinator says in place of the user",
    (file) => {
      const sentences = read(file)
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.includes("never send") && s.includes("to the coordinator"));
      expect(sentences.length).toBeGreaterThan(0);
      for (const sentence of sentences) expect(sentence).toContain("never send them to the coordinator in place of the user");
    },
  );
});

const PUBLISH_SENTENCES = [
  "When this session is an Orca worker, the run of this skill ends with the **published** report.",
  "After you tell the user about it, send `worker_done` once, with the command that Orca's preamble gives.",
  "Put the pull request link and the state of its checks in its body.",
  "Never send it while the run still goes on, for example at a question or at the approval gate, because it tells the coordinator that the ticket is done.",
  "When the run ends in any other way, for example with no pull request or with a failure after the pull request opened, also send `worker_done` once.",
  "Use `--outcome failed`, and give the reason in its body, as Orca's preamble asks.",
];

describe("an Orca worker sends worker_done once its pull request is open", () => {
  it.each(PUBLISH_SENTENCES.map((s, i) => [i + 1, s] as const))(
    "plan.md, report of the publish phase, sentence %i",
    (_i, sentence) => {
      expect(section(read("plan.md"), "The report of the publish phase")).toContain(sentence);
    },
  );

  it("plan.md no longer leaves a run without a pull request to the preamble alone", () => {
    expect(read("plan.md")).not.toContain("When the run ends without a pull request, Orca's preamble says what to do.");
  });

  it("plan.md names worker_done only after the published bullet and before Close the phase", () => {
    const lines = read("plan.md").split("\n");
    const from = lines.findIndex((l) => l.startsWith("- **published.**"));
    const to = lines.indexOf("## Close the phase");
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThan(from);
    const hits = lines.flatMap((l, i) => (l.includes("worker_done") ? [i] : []));
    expect(hits.length).toBeGreaterThan(0);
    for (const i of hits) {
      expect(i).toBeGreaterThan(from);
      expect(i).toBeLessThan(to);
    }
  });

  it("publish.md step 4 of Exit code 0 holds the new sentence", () => {
    const step = section(read("publish.md"), "Exit code 0")
      .split("\n")
      .find((l) => l.startsWith("4. Submit the report"));
    expect(step).toContain(
      "The report gives the pull request link and the state of the checks, because the main conversation passes them on.",
    );
  });

  it("guard: no other guide or skill names worker_done", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const f = join(dir, e.name);
        if (e.isDirectory()) walk(f);
        else if (e.name.endsWith(".md") && relative(root, f) !== "guides/resolve-issue/plan.md") {
          readFileSync(f, "utf8")
            .split("\n")
            .forEach((l, i) => {
              if (l.includes("worker_done")) found.push(`${relative(root, f)}:${i + 1}`);
            });
        }
      }
    };
    walk(join(root, "guides"));
    walk(join(root, "skills"));
    expect(found, found.join("\n")).toEqual([]);
  });

  it.each(["questions.md", "plan.md", "publish.md", "dependencies.md"])(
    "guard: the mandatory steps block of %s names no orca or worker",
    (file) => {
      const text = read(file);
      const block = text.slice(0, text.indexOf("-->"));
      expect(block.toLowerCase()).not.toMatch(/orca|worker/);
    },
  );

  it("guard: publish.md does not name Orca", () => {
    expect(read("publish.md").toLowerCase()).not.toContain("orca");
  });
});
