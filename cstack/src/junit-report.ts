// Reads a JUnit XML report into one entry per test case. No XML library is installed, and the
// reports of vitest and pytest only use a small part of XML, so one linear pass is enough.
// WHY: a <!DOCTYPE> is refused, so no entity can be defined or expanded by the report itself.

export type CaseOutcome = "passed" | "failed" | "error" | "skipped";

export interface TestCase {
  name: string;
  classname?: string;
  file?: string;
  outcome: CaseOutcome;
}

export class ReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportError";
  }
}

const NAMED: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const NAME = /[A-Za-z_:][\w.:-]*/y;

// A value quoted in a message: escaped by JSON.stringify and cut, so a terminal escape cannot get through.
function quote(v: string): string {
  let t = JSON.stringify(v);
  t = t.replace(/[\u007f-\u009f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return t.length > 60 ? `${t.slice(0, 60)}...` : t;
}

function allowed(cp: number): boolean {
  return cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff);
}

interface Open {
  name: string;
  line: number;
  test?: { name: string; classname?: string; file?: string; failure: boolean; error: boolean; skipped: boolean };
}

export function readJUnitReport(xml: string): TestCase[] {
  const text = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  if (text.trim() === "") throw new ReportError("The report is empty.");

  let pos = 0;
  let line = 1;
  let counted = 0;
  const lineAt = (p: number): number => {
    for (; counted < p; counted++) if (text[counted] === "\n") line++;
    return line;
  };
  const fail = (p: number, what: string): never => {
    throw new ReportError(`${what} (line ${lineAt(p)}).`);
  };

  const decode = (raw: string, p: number): string => {
    if (!raw.includes("&")) return raw;
    return raw.replace(/&([^;&\s<]*);?/g, (whole, ref: string) => {
      if (!whole.endsWith(";")) return fail(p, `Bad reference ${quote(whole)}, it has no ";"`);
      const num = /^#(?:x([0-9A-Fa-f]+)|([0-9]+))$/.exec(ref);
      if (num) {
        const cp = num[1] !== undefined ? parseInt(num[1], 16) : parseInt(num[2], 10);
        if (!allowed(cp)) return fail(p, `Character reference ${quote(whole)} is not allowed in XML`);
        return String.fromCodePoint(cp);
      }
      const named = NAMED[ref];
      return named ?? fail(p, `Unknown entity ${quote(whole)}`);
    });
  };

  const stack: Open[] = [];
  const cases: TestCase[] = [];
  let rootDone = false;

  const open = (name: string, attrs: Map<string, string>, p: number): Open => {
    if (stack.length === 0) {
      if (rootDone) fail(p, "Content after the root element");
      if (name !== "testsuites" && name !== "testsuite") {
        fail(p, `The root element must be <testsuites> or <testsuite>, not <${quote(name).slice(1, -1)}>`);
      }
    }
    const el: Open = { name, line: lineAt(p) };
    const parent = stack[stack.length - 1];
    if (name === "testcase") {
      const n = attrs.get("name");
      if (n === undefined) fail(p, "A <testcase> has no name attribute");
      el.test = { name: n as string, classname: attrs.get("classname"), file: attrs.get("file"), failure: false, error: false, skipped: false };
    } else if (parent?.test) {
      if (name === "failure") parent.test.failure = true;
      else if (name === "error") parent.test.error = true;
      else if (name === "skipped") parent.test.skipped = true;
    }
    return el;
  };

  const close = (el: Open): void => {
    if (!el.test) return;
    const t = el.test;
    const c: TestCase = { name: t.name, outcome: t.error ? "error" : t.failure ? "failed" : t.skipped ? "skipped" : "passed" };
    if (t.classname !== undefined) c.classname = t.classname;
    if (t.file !== undefined) c.file = t.file;
    cases.push(c);
  };

  while (pos < text.length) {
    const lt = text.indexOf("<", pos);
    const chunk = text.slice(pos, lt === -1 ? text.length : lt);
    if (stack.length === 0) {
      if (chunk.trim() !== "") fail(pos, "Text outside the root element");
    } else {
      decode(chunk, pos);
    }
    if (lt === -1) break;
    pos = lt;

    if (text.startsWith("<!--", pos)) {
      const end = text.indexOf("-->", pos + 4);
      if (end === -1) fail(pos, "A comment is not closed");
      pos = end + 3;
    } else if (text.startsWith("<?", pos)) {
      const end = text.indexOf("?>", pos + 2);
      if (end === -1) fail(pos, "A processing instruction is not closed");
      pos = end + 2;
    } else if (text.startsWith("<![CDATA[", pos)) {
      if (stack.length === 0) fail(pos, "Text outside the root element");
      const end = text.indexOf("]]>", pos + 9);
      if (end === -1) fail(pos, "A CDATA section is not closed");
      pos = end + 3;
    } else if (text.startsWith("<!", pos)) {
      fail(pos, text.startsWith("<!DOCTYPE", pos) ? "A <!DOCTYPE> is not accepted in a report" : "An unknown <! declaration");
    } else if (text.startsWith("</", pos)) {
      const end = text.indexOf(">", pos);
      if (end === -1) fail(pos, "An end tag is not closed");
      const name = text.slice(pos + 2, end).trim();
      const top = stack[stack.length - 1];
      if (!top) fail(pos, `The end tag ${quote(`</${name}>`)} has no start tag`);
      if (top.name !== name) {
        fail(pos, `The end tag ${quote(`</${name}>`)} does not match the start tag ${quote(`<${top.name}>`)} from line ${top.line}`);
      }
      close(stack.pop() as Open);
      if (stack.length === 0) rootDone = true;
      pos = end + 1;
    } else {
      const start = pos;
      NAME.lastIndex = pos + 1;
      const m = NAME.exec(text);
      if (!m) fail(pos, "A tag has no valid name");
      const name = (m as RegExpExecArray)[0];
      pos = NAME.lastIndex;
      const attrs = new Map<string, string>();
      let selfClosing = false;
      for (;;) {
        while (pos < text.length && /\s/.test(text[pos])) pos++;
        if (text.startsWith("/>", pos)) {
          selfClosing = true;
          pos += 2;
          break;
        }
        if (text[pos] === ">") {
          pos++;
          break;
        }
        NAME.lastIndex = pos;
        const a = NAME.exec(text);
        if (!a) fail(start, `The tag <${quote(name).slice(1, -1)}> is not well formed`);
        const key = (a as RegExpExecArray)[0];
        pos = NAME.lastIndex;
        const eq = /\s*=\s*(["'])/y;
        eq.lastIndex = pos;
        const e = eq.exec(text);
        if (!e) fail(start, `The attribute ${quote(key)} has no quoted value`);
        const valueStart = eq.lastIndex;
        const valueEnd = text.indexOf((e as RegExpExecArray)[1], valueStart);
        if (valueEnd === -1) fail(start, `The value of the attribute ${quote(key)} is not closed`);
        const raw = text.slice(valueStart, valueEnd);
        if (raw.includes("<")) fail(start, `The value of the attribute ${quote(key)} holds a "<"`);
        attrs.set(key, decode(raw, start));
        pos = valueEnd + 1;
      }
      const el = open(name, attrs, start);
      if (selfClosing) {
        close(el);
        if (stack.length === 0) rootDone = true;
      } else {
        stack.push(el);
      }
    }
  }

  const unclosed = stack[stack.length - 1];
  if (unclosed) throw new ReportError(`The tag ${quote(`<${unclosed.name}>`)} from line ${unclosed.line} is not closed.`);
  return cases;
}
