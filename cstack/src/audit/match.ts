// Decides whether a cstack call, as the shell reader splits it, fits a command step of a guide.

const PLACEHOLDER = /^<[^<>]+>(\.\.\.)?$/;

// Splits the text of a step into words. Quotes are removed.
// A placeholder such as `<plan file>` stays one word, even with a space inside.
export function stepWords(text: string): string[] {
  const body = text.trim().replace(/^cstack\s+/, "");
  const words: string[] = [];
  let cur = "";
  let inWord = false;
  let quote = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === quote) quote = "";
      else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
    } else if (/\s/.test(c)) {
      if (inWord) words.push(cur);
      cur = "";
      inWord = false;
    } else if (c === "<" && !inWord) {
      const end = body.indexOf(">", i);
      const stop = end < 0 ? i : end;
      cur += body.slice(i, stop + 1);
      i = stop;
      inWord = true;
    } else {
      cur += c;
      inWord = true;
    }
  }
  if (inWord) words.push(cur);
  return words;
}

export function split(words: string[]): { head: string[]; flags: string[] } {
  const i = words.findIndex((x) => x.startsWith("-"));
  return i < 0 ? { head: words, flags: [] } : { head: words.slice(0, i), flags: words.slice(i) };
}

function matchHead(step: string[], call: string[], unit: number | undefined): boolean {
  if (step.length === 0) return call.length === 0;
  const [s, ...rest] = step;
  if (s.endsWith("...") && PLACEHOLDER.test(s)) {
    for (let k = 1; k <= call.length; k++) {
      const taken = call.slice(0, k);
      if (s === "<n>..." && unit !== undefined && !taken.includes(String(unit))) continue;
      if (matchHead(rest, call.slice(k), unit)) return true;
    }
    return false;
  }
  if (call.length === 0) return false;
  if (PLACEHOLDER.test(s)) {
    if (s === "<n>" && unit !== undefined && call[0] !== String(unit)) return false;
    return matchHead(rest, call.slice(1), unit);
  }
  return s === call[0] && matchHead(rest, call.slice(1), unit);
}

function hasFlag(flags: string[], flag: string, value: string | undefined): boolean {
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f === flag) {
      if (value === undefined || flags[i + 1] === value) return true;
    } else if (f.startsWith(`${flag}=`)) {
      if (value === undefined || f.slice(flag.length + 1) === value) return true;
    }
  }
  return false;
}

export function matchesStep(step: string[], call: string[], unit?: number): boolean {
  const s = split(step);
  const c = split(call);
  if (!matchHead(s.head, c.head, unit)) return false;
  for (let i = 0; i < s.flags.length; i++) {
    const flag = s.flags[i];
    if (!flag.startsWith("-")) continue;
    const next = s.flags[i + 1];
    const value = next !== undefined && !next.startsWith("-") ? next : undefined;
    if (value !== undefined) i++;
    if (value !== undefined && PLACEHOLDER.test(value)) continue;
    if (!hasFlag(c.flags, flag, value)) return false;
  }
  return true;
}
