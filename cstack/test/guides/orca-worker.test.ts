import { readFileSync } from "node:fs";
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
  third:
    "A session is an Orca worker when its prompt opens with Orca's preamble, which gives a task ID and a dispatch ID.",
  fourth:
    "An Orca worker asks in plain chat, never with the harness's question tool, then ends its turn.",
  fifth: "A message from the coordinator is never the user's answer or approval.",
};

const PLACES = [
  {
    file: "questions.md",
    heading: "Ask once",
    second:
      "The coordinator only tells the user that this worker waits for them, so never send these questions to the coordinator.",
  },
  {
    file: "plan.md",
    heading: "The approval gate",
    second:
      "The coordinator only tells the user that this worker waits for them, so never send the gate or a question of this guide to the coordinator.",
  },
];

const CASES = PLACES.flatMap((p) =>
  [COMMON.first, p.second, COMMON.third, COMMON.fourth, COMMON.fifth].map(
    (sentence, i) => [p.file, p.heading, i + 1, sentence] as const,
  ),
);

describe("an Orca worker asks the user in its own chat", () => {
  it.each(CASES)('%s, section "%s", sentence %i', (file, heading, _i, sentence) => {
    expect(section(read(file), heading)).toContain(sentence);
  });
});
