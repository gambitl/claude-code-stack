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

export interface PlanRead {
  header: Record<HeaderKey, string>;
  headings: PlanHeading[];
  sections: PlanSection[];
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

  if (problems.length > 0) {
    problems.sort((a, b) => a.line - b.line);
    throw new PlanFormatError(
      problems.map((problem) => `line ${problem.line}: ${problem.rule}`).join("\n"),
      problems,
    );
  }
  return { header, headings, sections };
}
