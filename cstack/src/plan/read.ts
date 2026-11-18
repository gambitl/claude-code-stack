export const PLAN_FORMAT = "cstack-plan/1";

export const HEADER_KEYS = [
  "Format",
  "Written by",
  "Date",
  "Ticket",
  "Tracker",
  "Documentation tool",
  "Branch",
  "Target branch",
  "Conversation language",
  "Status",
  "Approved at",
  "Ready for review at",
] as const;

export const SECTION_NAMES = [
  "Ticket",
  "Dependencies",
  "Code mapping",
  "Decisions",
  "Architecture",
  "Implementation units",
  "Documentation duties",
  "Blocking questions",
  "Review log",
  "Briefing",
  "Non-blocking questions",
  "Pull request",
  "Documentation",
  "Executor notes",
  "Hand-off log",
  "History",
] as const;

export const DONE_REPORT_SECTIONS: readonly SectionName[] = [
  "Ticket",
  "Dependencies",
  "Code mapping",
  "Decisions",
  "Architecture",
  "Implementation units",
  "Documentation duties",
  "Blocking questions",
  "Review log",
  "Briefing",
  "Non-blocking questions",
  "Pull request",
  "Documentation",
  "Executor notes",
];

export const STATUS_VALUES = [
  "draft",
  "waiting for answers",
  "questions answered",
  "approved",
  "in progress",
  "review",
  "ready for review",
] as const;

export type HeaderKey = (typeof HEADER_KEYS)[number];
export type SectionName = (typeof SECTION_NAMES)[number];

export interface PlanProblem {
  line: number;
  rule: string;
}

export interface PlanHeading {
  level: number;
  line: number;
  text: string;
}

export interface PlanSection {
  name: SectionName;
  first: number;
  last: number;
  filled: boolean;
}

export interface PlanUnit {
  number: number;
  name: string;
  line: number;
  files: string[];
  test?: { file: string; case: string };
  noTest?: string;
  minimumCode: string;
  refactor: string;
  commitMessage: string;
  dependsOn: number[];
  designSpecification?: string;
  blocked?: string;
}

export interface BlockingQuestion {
  number: number;
  title: string;
  line: number;
  text: string;
  for: string;
  answer: string;
  open: boolean;
}

export interface PlanPullRequest {
  title: string;
  body: string;
}

export interface PlanRead {
  header: Record<HeaderKey, string>;
  headings: PlanHeading[];
  sections: PlanSection[];
  units: PlanUnit[];
  blockingQuestions: BlockingQuestion[];
  pullRequest?: PlanPullRequest;
}

export class PlanFormatError extends Error {
  readonly exitCode = 3;
  constructor(
    message: string,
    readonly problems: PlanProblem[] = [],
  ) {
    super(message);
    this.name = "PlanFormatError";
  }
}

export function isBranchName(name: string): boolean {
  return (
    /^[A-Za-z0-9._+/-]+$/.test(name) &&
    !/^[-/.]/.test(name) &&
    !/(\/|\.|\.lock)$/.test(name) &&
    !name.includes("..") &&
    !name.includes("//")
  );
}

const isPlaceholder = (text: string) => text.startsWith("<") && text.endsWith(">");

interface Scanned {
  headings: PlanHeading[];
  // Lines of HTML comments (1-based). Fenced lines are not in this set, because they are content.
  comments: Set<number>;
  problems: PlanProblem[];
}

function scan(lines: string[]): Scanned {
  const headings: PlanHeading[] = [];
  const comments = new Set<number>();
  const problems: PlanProblem[] = [];
  let fence: { char: string; size: number; line: number } | undefined;
  let inComment = false;

  lines.forEach((text, index) => {
    const line = index + 1;
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(text);
      if (close && close[1][0] === fence.char && close[1].length >= fence.size) fence = undefined;
      return;
    }
    if (inComment) {
      comments.add(line);
      if (text.includes("-->")) inComment = false;
      return;
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(text);
    if (open) {
      fence = { char: open[1][0], size: open[1].length, line };
      return;
    }
    if (text.trimStart().startsWith("<!--")) {
      comments.add(line);
      if (!text.includes("-->", text.indexOf("<!--") + 4)) inComment = true;
      return;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/.exec(text);
    if (heading) {
      const title = (heading[2] ?? "").replace(/(?:^|[ \t]+)#+$/, "").trim();
      headings.push({ level: heading[1].length, line, text: title });
    }
  });

  if (fence) {
    problems.push({
      line: fence.line,
      rule: "A code fence opened here is never closed. Close it with the same fence characters.",
    });
  }
  return { headings, comments, problems };
}

// WHY: ADR-SIC-B (docs/decisions/ADR-SIC-B-run-state.md). An unknown format version is refused, and the message names the cstack version that can read the file.
function stopOnFormat(lines: string[], firstHeadingLine: number): void {
  const region = lines.slice(0, firstHeadingLine - 1);
  const value = (key: string) =>
    region.map((text) => new RegExp(`^${key}:\\s*(.*)$`).exec(text)).find(Boolean)?.[1].trim();
  const format = value("Format");
  if (format === undefined) {
    throw new PlanFormatError(
      `This plan file has no Format line. The prose skill wrote it before cstack existed. This cstack reads ${PLAN_FORMAT}.`,
    );
  }
  if (format !== PLAN_FORMAT) {
    const writer = /^cstack (\S+)$/.exec(value("Written by") ?? "");
    const reader = writer
      ? `cstack ${writer[1]} can read it.`
      : "The file does not name the cstack version that can read it.";
    throw new PlanFormatError(
      `This plan file has the format ${format}. This cstack reads ${PLAN_FORMAT}. ${reader}`,
    );
  }
}

function checkHeaderValue(key: HeaderKey, value: string): string | undefined {
  if (value === "" || isPlaceholder(value)) {
    return `${key} is empty or still a placeholder. Write its real value.`;
  }
  switch (key) {
    case "Written by":
      return value === "not yet" || /^cstack \S+$/.test(value)
        ? undefined
        : "Written by holds `cstack <version>` or `not yet`.";
    case "Date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : "Date holds YYYY-MM-DD.";
    case "Branch":
    case "Target branch":
      return isBranchName(value) ? undefined : `${key} is not a valid git branch name.`;
    case "Status":
      return (STATUS_VALUES as readonly string[]).includes(value)
        ? undefined
        : `Status holds one of: ${STATUS_VALUES.join(", ")}.`;
    case "Approved at":
    case "Ready for review at":
      return value === "not yet" ||
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value)
        ? undefined
        : `${key} holds YYYY-MM-DDTHH:MM:SS±HH:MM or \`not yet\`.`;
    default:
      return undefined;
  }
}

interface Region {
  lines: string[];
  headings: PlanHeading[];
  comments: Set<number>;
  problems: PlanProblem[];
}

// The lines of a section that are neither blank nor comments, with their 1-based numbers.
function contentLines(region: Region, first: number, last: number) {
  const found: { line: number; text: string }[] = [];
  for (let line = first; line <= last; line++) {
    const text = region.lines[line - 1];
    if (text.trim() !== "" && !region.comments.has(line)) found.push({ line, text });
  }
  return found;
}

function pathProblem(path: string): string | undefined {
  if (!/^[A-Za-z0-9._/@+-]+$/.test(path)) {
    return `The path \`${path}\` holds a character that a unit path does not allow. Use ASCII letters, digits and . _ - / @ + only.`;
  }
  if (path.startsWith("/")) return `The path \`${path}\` starts with /. A unit path is relative to the repository root.`;
  if (path.startsWith("-")) return `The path \`${path}\` starts with -. A unit path never starts with a dash.`;
  if (path.endsWith("/")) return `The path \`${path}\` ends with /. Name a file.`;
  if (path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    return `The path \`${path}\` has an empty, . or .. part (the .. part leaves the repository).`;
  }
  return undefined;
}

const UNIT_FIELDS = [
  ["Files"],
  ["Test", "No test"],
  ["Minimum code"],
  ["Refactor"],
  ["Commit message"],
  ["Depends on"],
  ["Design specification"],
  ["Blocked"],
] as const;
const REQUIRED_FIELDS = 6;
const FIELD_LINE = /^- (Files|Test|No test|Minimum code|Refactor|Commit message|Depends on|Design specification|Blocked):(?: (.*))?$/;

function readUnit(region: Region, number: number, heading: PlanHeading, last: number): PlanUnit {
  const { problems } = region;
  const values: Record<string, { line: number; text: string }> = {};
  let slot = -1;
  let current: string | undefined;
  for (let line = heading.line + 1; line <= last; line++) {
    const text = region.lines[line - 1];
    if (region.comments.has(line)) continue;
    const field = FIELD_LINE.exec(text);
    if (field) {
      const label = field[1];
      const index = UNIT_FIELDS.findIndex((names) => (names as readonly string[]).includes(label));
      if (index <= slot) {
        problems.push({ line, rule: `The line \`- ${label}:\` is repeated or out of order. The unit lines come in a fixed order.` });
        continue;
      }
      for (let missing = slot + 1; missing < Math.min(index, REQUIRED_FIELDS); missing++) {
        problems.push({
          line,
          rule: missing === 1
            ? "Unit " + number + " has neither `- Test:` nor `- No test:` after `- Files:`."
            : `Unit ${number} has no \`- ${UNIT_FIELDS[missing][0]}:\` line.`,
        });
      }
      slot = index;
      current = label;
      values[label] = { line, text: (field[2] ?? "").trim() };
      continue;
    }
    if (slot >= 5) continue; // After Depends on, free notes and optional lines follow.
    const continues = text.trim() === "" || text.startsWith("  ");
    if (continues && current !== undefined && current !== "Commit message") {
      if (text.trim() !== "") values[current].text += ` ${text.trim()}`;
      continue;
    }
    if (text.trim() === "" && current === undefined) continue;
    problems.push({
      line,
      rule: text.trim() === ""
        ? "A blank line cannot follow `- Commit message:`. The next line is `- Depends on:`."
        : "This line does not belong to the unit. Write one of the unit lines in their fixed order, or indent a continued line by two spaces.",
    });
  }
  if (slot < 5) {
    for (let missing = slot + 1; missing < REQUIRED_FIELDS; missing++) {
      problems.push({
        line: last,
        rule: missing === 1
          ? `Unit ${number} has neither \`- Test:\` nor \`- No test:\`.`
          : `Unit ${number} has no \`- ${UNIT_FIELDS[missing][0]}:\` line.`,
      });
    }
  }

  const unit: PlanUnit = {
    number,
    name: heading.text.replace(/^Unit \d+:\s*/, ""),
    line: heading.line,
    files: [],
    minimumCode: values["Minimum code"]?.text ?? "",
    refactor: values["Refactor"]?.text ?? "",
    commitMessage: (values["Commit message"]?.text ?? "").replace(/^`(.*)`$/, "$1"),
    dependsOn: [],
  };
  if (values["Files"]) {
    const { line, text } = values["Files"];
    if (!/^`[^`]+`(?:, `[^`]+`)*$/.test(text)) {
      problems.push({ line, rule: "`- Files:` lists one or more paths in backticks, separated by `, `." });
    } else {
      unit.files = text.slice(1, -1).split("`, `");
      for (const path of unit.files) {
        const problem = pathProblem(path);
        if (problem) problems.push({ line, rule: problem });
      }
    }
  }
  if (values["Test"]) {
    const { line, text } = values["Test"];
    const parsed = /^`([^`]+)`: (.+)$/.exec(text);
    if (!parsed) {
      problems.push({ line, rule: "`- Test:` holds `<test file>`: <failing case>, with the file in backticks." });
    } else {
      unit.test = { file: parsed[1], case: parsed[2] };
      if (!unit.files.includes(parsed[1])) {
        problems.push({ line, rule: `The test file \`${parsed[1]}\` is missing from \`- Files:\`.` });
      }
    }
  }
  if (values["No test"]) unit.noTest = values["No test"].text;
  if (values["Design specification"]) unit.designSpecification = values["Design specification"].text;
  if (values["Blocked"]) unit.blocked = values["Blocked"].text;
  for (const label of ["Minimum code", "Refactor", "Commit message", "Depends on", "No test"]) {
    if (values[label] && values[label].text === "") {
      problems.push({ line: values[label].line, rule: `\`- ${label}:\` is empty.` });
    }
  }
  const depends = values["Depends on"];
  if (depends && depends.text !== "none") {
    if (/^\d+(, \d+)*$/.test(depends.text)) unit.dependsOn = depends.text.split(", ").map(Number);
    else problems.push({ line: depends.line, rule: "`- Depends on:` holds unit numbers separated by `, `, or the word `none`." });
  }
  return unit;
}

function readUnits(region: Region, section: PlanSection | undefined): PlanUnit[] {
  if (!section) return [];
  const { problems } = region;
  const unitHeadings = region.headings.filter(
    (heading) => heading.level === 3 && heading.line > section.first && heading.line <= section.last,
  );
  const units: PlanUnit[] = [];
  unitHeadings.forEach((heading, index) => {
    const parsed = /^Unit ([1-9]\d*): (\S.*)$/.exec(heading.text);
    if (!parsed) {
      problems.push({ line: heading.line, rule: "A heading in the units section is `### Unit <n>: <name>`." });
      return;
    }
    if (/status:/i.test(parsed[2])) {
      problems.push({ line: heading.line, rule: "A unit heading carries no status. The commits show what is done." });
    }
    const number = Number(parsed[1]);
    if (number !== units.length + 1) {
      problems.push({ line: heading.line, rule: `Unit ${number} is out of place. Units are numbered from 1 with no gap, so Unit ${units.length + 1} comes here.` });
    }
    const next = unitHeadings[index + 1]?.line ?? section.last + 1;
    units.push(readUnit(region, number, heading, next - 1));
  });
  for (const unit of units) {
    let line = unit.line;
    while (line < section.last && !region.lines[line].startsWith("- Depends on:")) line++;
    for (const target of unit.dependsOn) {
      if (target === unit.number || !units.some((other) => other.number === target)) {
        problems.push({
          line: line + 1,
          rule: target === unit.number
            ? `Unit ${unit.number} depends on itself.`
            : `Unit ${unit.number} depends on Unit ${target}, which does not exist.`,
        });
      }
    }
  }
  return units;
}

function readQuestions(region: Region, section: PlanSection | undefined): BlockingQuestion[] {
  if (!section || !section.filled) return [];
  const { problems } = region;
  const content = contentLines(region, section.first + 1, section.last);
  const headings = region.headings.filter(
    (heading) => heading.level === 3 && heading.line > section.first && heading.line <= section.last,
  );
  const none = content.filter(({ text }) => text.trim() === "none");
  if (headings.length === 0) {
    if (none.length !== 1 || content.length !== 1) {
      problems.push({ line: content[0].line, rule: "Blocking questions holds the word `none`, or questions with `### Question <n>: <a few words>` headings." });
    }
    return [];
  }
  for (const { line } of none) {
    problems.push({ line, rule: "The word `none` cannot sit next to a question. Remove it." });
  }
  const questions: BlockingQuestion[] = [];
  headings.forEach((heading, index) => {
    const parsed = /^Question ([1-9]\d*): (\S.*)$/.exec(heading.text);
    if (!parsed) {
      problems.push({ line: heading.line, rule: "A heading in the blocking questions is `### Question <n>: <a few words>`." });
      return;
    }
    const number = Number(parsed[1]);
    if (number !== questions.length + 1) {
      problems.push({ line: heading.line, rule: `Question ${number} is out of place. Questions are numbered from 1 with no gap, so Question ${questions.length + 1} comes here.` });
    }
    const last = (headings[index + 1]?.line ?? section.last + 1) - 1;
    const body = contentLines(region, heading.line + 1, last);
    const forIndex = body.findIndex(({ text }) => text.startsWith("- For: "));
    const answerIndex = body.findIndex(({ text }) => text.startsWith("- Answer: "));
    if (forIndex === -1) problems.push({ line: heading.line, rule: `Question ${number} has no \`- For:\` line.` });
    if (answerIndex === -1) problems.push({ line: heading.line, rule: `Question ${number} has no \`- Answer:\` line. Write \`- Answer: open\` when nobody has answered.` });
    const firstField = [forIndex, answerIndex].filter((i) => i !== -1).reduce((a, b) => Math.min(a, b), body.length);
    const answer = answerIndex === -1 ? "" : body[answerIndex].text.slice("- Answer: ".length).trim();
    questions.push({
      number,
      title: parsed[2],
      line: heading.line,
      text: body.slice(0, firstField).map(({ text }) => text).join("\n"),
      for: forIndex === -1 ? "" : body[forIndex].text.slice("- For: ".length).trim(),
      answer,
      open: answer === "open",
    });
  });
  return questions;
}

function readPullRequest(region: Region, section: PlanSection | undefined): PlanPullRequest | undefined {
  if (!section || !section.filled) return undefined;
  const { lines, problems } = region;
  const content = contentLines(region, section.first + 1, section.last);
  const title = content.map(({ text }) => /^Title: (\S.*)$/.exec(text)?.[1].trim()).find(Boolean);
  if (title === undefined) {
    problems.push({ line: section.first, rule: "The pull request section needs a line `Title: <title>`." });
  }
  const open = content.find(({ text }) => /^````markdown[ \t]*$/.test(text));
  const close = open && content.find(({ line, text }) => line > open.line && /^````[ \t]*$/.test(text));
  if (!open || !close) {
    problems.push({ line: section.first, rule: "The pull request body needs a block that opens with four backticks and the word markdown, and closes with four backticks." });
    return undefined;
  }
  if (title === undefined) return undefined;
  return { title, body: lines.slice(open.line, close.line - 1).join("\n") };
}

export function readPlan(text: string): PlanRead {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const { headings, comments, problems } = scan(lines);

  const firstSection = headings.find((heading) => heading.level === 2);
  stopOnFormat(lines, firstSection?.line ?? lines.length + 1);

  // Title and header.
  const title = headings.find((heading) => heading.level === 1);
  if (!title || title.line !== 1 || !/^Plan: \S/.test(title.text)) {
    problems.push({ line: 1, rule: "The first line is the title `# Plan: <ticket id> — <ticket title>`." });
  }
  for (const extra of headings.filter((heading) => heading.level === 1 && heading !== title)) {
    problems.push({ line: extra.line, rule: "The title is the only level-1 heading." });
  }

  const header = {} as Record<HeaderKey, string>;
  const headerEnd = firstSection?.line ?? lines.length + 1;
  let next = 0;
  for (let line = 2; line < headerEnd; line++) {
    const content = lines[line - 1];
    if (comments.has(line) || content.trim() === "") continue;
    const parsed = /^([^:]+):\s*(.*)$/.exec(content);
    const key = HEADER_KEYS[next];
    if (!parsed || parsed[1] !== key) {
      problems.push({
        line,
        rule: key
          ? `Expected the header line \`${key}:\` here. The header keys come in a fixed order.`
          : "Only the header keys, blank lines and comments may come before the first section.",
      });
      if (!key) continue;
      if (!parsed || !(HEADER_KEYS as readonly string[]).includes(parsed[1])) continue;
      next = HEADER_KEYS.indexOf(parsed[1] as HeaderKey);
    }
    const name = HEADER_KEYS[next];
    const value = parsed![2].trim();
    header[name] = value;
    const problem = checkHeaderValue(name, value);
    if (problem) problems.push({ line, rule: problem });
    next++;
  }
  for (const key of HEADER_KEYS.slice(next)) {
    problems.push({ line: headerEnd - 1, rule: `The header line \`${key}:\` is missing.` });
  }

  // Sections.
  const sectionHeadings = headings.filter((heading) => heading.level === 2);
  const sections: PlanSection[] = [];
  let expected = 0;
  sectionHeadings.forEach((heading, index) => {
    const known = SECTION_NAMES.indexOf(heading.text as SectionName);
    if (known === -1) {
      problems.push({
        line: heading.line,
        rule: `\`## ${heading.text}\` is not a section of the plan file. A heading of the ticket needs to move down one level.`,
      });
      return;
    }
    if (known !== expected) {
      problems.push({
        line: heading.line,
        rule: `Section ${heading.text} is out of order or repeated. The sections come in a fixed order, each once.`,
      });
    }
    expected = Math.max(expected, known + 1);
    const last = (sectionHeadings[index + 1]?.line ?? lines.length + 1) - 1;
    const filled = lines.slice(heading.line, last).some((content, offset) => {
      const trimmed = content.trim();
      return trimmed !== "" && !comments.has(heading.line + 1 + offset) && !isPlaceholder(trimmed);
    });
    sections.push({ name: heading.text as SectionName, first: heading.line, last, filled });
  });
  for (const name of SECTION_NAMES) {
    if (!sections.some((section) => section.name === name)) {
      problems.push({ line: lines.length, rule: `The section ${name} is missing.` });
    }
  }

  const region: Region = { lines, headings, comments, problems };
  const section = (name: SectionName) => sections.find((candidate) => candidate.name === name);
  const units = readUnits(region, section("Implementation units"));
  const blockingQuestions = readQuestions(region, section("Blocking questions"));
  const pullRequest = readPullRequest(region, section("Pull request"));

  if (problems.length > 0) {
    problems.sort((a, b) => a.line - b.line);
    throw new PlanFormatError(
      problems.map((problem) => `line ${problem.line}: ${problem.rule}`).join("\n"),
      problems,
    );
  }
  return { header, headings, sections, units, blockingQuestions, pullRequest };
}
