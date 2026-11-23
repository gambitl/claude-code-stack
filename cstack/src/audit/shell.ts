// Finds the `cstack` commands inside a shell command, without running it.
// One pass over the characters. Quotes, comments, heredoc bodies and
// redirections are handled so that text which only mentions cstack is not a call.

const SKIPPED_WORDS = new Set([
  "!", "{", "if", "then", "do", "else", "elif", "while", "until", "time", "command", "exec", "env",
]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const REDIRECTION = /^\d*(?:>>|>\||>&|<&|&>|>|<)/;
const REDIRECTION_ONLY = /^\d*(?:>>|>\||>&|<&|&>|>|<)$/;

interface Word {
  text: string;
  quoted: boolean;
}

function toArguments(words: Word[], programs: readonly string[]): string[] | null {
  let i = 0;
  while (i < words.length && (ASSIGNMENT.test(words[i].text) || SKIPPED_WORDS.has(words[i].text))) i++;
  if (i >= words.length || !programs.includes(words[i].text) || words[i].quoted) return null;
  const args: string[] = [];
  for (let j = i + 1; j < words.length; j++) {
    const w = words[j];
    if (!w.quoted && REDIRECTION.test(w.text)) {
      if (REDIRECTION_ONLY.test(w.text)) j++;
      continue;
    }
    args.push(w.text);
  }
  return args;
}

export function cstackCommands(command: string): string[][] {
  return commandsOf(command, ["cstack"]);
}

// The arguments of each simple command whose program is one of the given words.
export function commandsOf(command: string, programs: readonly string[]): string[][] {
  const result: string[][] = [];
  const heredocs: { word: string; strip: boolean }[] = [];
  let words: Word[] = [];
  let text = "";
  let inWord = false;
  let quoted = false;

  const endWord = (): void => {
    if (inWord) words.push({ text, quoted });
    text = "";
    inWord = false;
    quoted = false;
  };
  const endCommand = (): void => {
    endWord();
    const args = toArguments(words, programs);
    if (args) result.push(args);
    words = [];
  };
  const skipHeredocBodies = (from: number): number => {
    let i = from;
    for (const h of heredocs) {
      while (i < command.length) {
        let end = command.indexOf("\n", i);
        if (end === -1) end = command.length;
        let line = command.slice(i, end);
        i = Math.min(end + 1, command.length);
        if (h.strip) line = line.replace(/^\t+/, "");
        if (line === h.word) break;
      }
    }
    heredocs.length = 0;
    return i;
  };

  let i = 0;
  while (i < command.length) {
    const c = command[i];
    if (c === "\n") {
      endCommand();
      i++;
      if (heredocs.length > 0) i = skipHeredocBodies(i);
    } else if (c === " " || c === "\t") {
      endWord();
      i++;
    } else if (c === "\\") {
      if (command[i + 1] === "\n") {
        i += 2;
      } else {
        if (i + 1 < command.length) text += command[i + 1];
        inWord = true;
        quoted = true;
        i += 2;
      }
    } else if (c === "'") {
      const end = command.indexOf("'", i + 1);
      const stop = end === -1 ? command.length : end;
      text += command.slice(i + 1, stop);
      inWord = true;
      quoted = true;
      i = stop + 1;
    } else if (c === '"') {
      i++;
      while (i < command.length && command[i] !== '"') {
        if (command[i] === "\\" && i + 1 < command.length) {
          const next = command[i + 1];
          if (next === "\n") {
            i += 2;
            continue;
          }
          if ('"\\$`'.includes(next)) i++;
        }
        text += command[i];
        i++;
      }
      inWord = true;
      quoted = true;
      i++;
    } else if (c === "#" && !inWord) {
      while (i < command.length && command[i] !== "\n") i++;
    } else if (c === "<" && command.startsWith("<<", i) && command[i + 2] !== "<") {
      // A heredoc: read its end word, then skip its body at the next newline.
      endWord();
      i += 2;
      let strip = false;
      if (command[i] === "-") {
        strip = true;
        i++;
      }
      while (command[i] === " " || command[i] === "\t") i++;
      let word = "";
      while (i < command.length && !/[\s;&|()<>]/.test(command[i])) {
        const ch = command[i];
        if (ch === "'" || ch === '"') {
          const end = command.indexOf(ch, i + 1);
          const stop = end === -1 ? command.length : end;
          word += command.slice(i + 1, stop);
          i = stop + 1;
        } else if (ch === "\\" && i + 1 < command.length) {
          word += command[i + 1];
          i += 2;
        } else {
          word += ch;
          i++;
        }
      }
      heredocs.push({ word, strip });
    } else if (c === "&" || c === "|") {
      const redirectionPart = (c === "&" && (command[i + 1] === ">" || /[<>]$/.test(text))) || (c === "|" && />$/.test(text));
      if (redirectionPart && inWord) {
        text += c;
        i++;
      } else if (c === "&" && command[i + 1] === ">") {
        text += c;
        inWord = true;
        i++;
      } else {
        endCommand();
        i++;
        if ((c === "&" && command[i] === "&") || (c === "|" && (command[i] === "|" || command[i] === "&"))) i++;
      }
    } else if (c === ";" || c === "(" || c === ")") {
      endCommand();
      i++;
    } else {
      text += c;
      inWord = true;
      i++;
    }
  }
  endCommand();
  return result;
}
