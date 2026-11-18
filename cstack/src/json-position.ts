export type JsonErrorPosition = { line: number; column: number; reason: string };

class Stop extends Error {
  constructor(
    readonly pos: number,
    readonly reason: string,
  ) {
    super(reason);
  }
}

/**
 * Walks the text as JSON and says where the first syntax error is, counted
 * from line 1 and column 1. It returns nothing when it finds no error.
 * The reasons are written here and never copy the text of the file.
 */
export function locateJsonError(text: string): JsonErrorPosition | undefined {
  let i = 0;
  const ws = () => {
    while (i < text.length && " \t\n\r".includes(text[i]!)) i++;
  };
  const fail = (reason: string): never => {
    throw new Stop(i, i >= text.length ? "the text ends too early" : reason);
  };
  const literal = (word: string) => {
    if (!text.startsWith(word, i)) fail("unexpected character");
    i += word.length;
  };
  const string = () => {
    i++;
    while (i < text.length) {
      const c = text[i]!;
      if (c === '"') return void i++;
      if (c < " ") fail("a line break or control character inside a string");
      if (c === "\\") {
        i++;
        const e = text[i];
        if (e === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) fail("a bad \\u escape");
          i += 4;
        } else if (e === undefined || !'"\\/bfnrt'.includes(e)) fail("a bad escape");
      }
      i++;
    }
    fail("a string that is not closed");
  };
  const number = () => {
    const m = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(text.slice(i));
    if (!m) fail("a bad number");
    i += m![0].length;
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      ws();
      if (text[i] === "}") return void i++;
      for (;;) {
        ws();
        if (text[i] !== '"') fail("a property name in double quotes is expected");
        string();
        ws();
        if (text[i] !== ":") fail("a colon is expected after the property name");
        i++;
        value();
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") return void i++;
        fail("a comma or a closing brace is expected");
      }
    } else if (c === "[") {
      i++;
      ws();
      if (text[i] === "]") return void i++;
      for (;;) {
        value();
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") return void i++;
        fail("a comma or a closing bracket is expected");
      }
    } else if (c === '"') string();
    else if (c === "t") literal("true");
    else if (c === "f") literal("false");
    else if (c === "n") literal("null");
    else if (c === "-" || (c !== undefined && c >= "0" && c <= "9")) number();
    else fail("a value is expected");
  };
  try {
    value();
    ws();
    if (i < text.length) fail("unexpected content after the end of the value");
  } catch (err) {
    if (!(err instanceof Stop)) throw err;
    const before = text.slice(0, err.pos).split("\n");
    return { line: before.length, column: before[before.length - 1]!.length + 1, reason: err.reason };
  }
  return undefined;
}
