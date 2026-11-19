// Changes the value of named header lines of a plan file. Every other byte stays the same,
// including the line endings, the comments and everything below the header.
export function setHeaderValues(text: string, values: Record<string, string>): string {
  const lines = text.split("\n");
  const pending = new Set(Object.keys(values));
  let inComment = false;

  for (let index = 0; index < lines.length && pending.size > 0; index++) {
    const line = lines[index];
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }
    if (line.trimStart().startsWith("<!--")) {
      if (!line.includes("-->", line.indexOf("<!--") + 4)) inComment = true;
      continue;
    }
    if (/^ {0,3}##(?:[ \t]|$)/.test(line)) break;
    const match = /^([^:\s][^:]*):/.exec(line);
    if (!match || !pending.has(match[1])) continue;
    const ending = line.endsWith("\r") ? "\r" : "";
    lines[index] = `${match[1]}: ${values[match[1]]}${ending}`;
    pending.delete(match[1]);
  }

  if (pending.size > 0) {
    throw new Error(`The plan header has no line for: ${[...pending].join(", ")}.`);
  }
  return lines.join("\n");
}
