import { createInterface } from "node:readline";


/** True only for `y` and `yes`, in any case, after trimming. Anything else, even an empty answer, means no. */
export function isYes(answer: string): boolean {
  return ["y", "yes"].includes(answer.trim().toLowerCase());
}

/** Reads one line from `input` and closes its reader, so the process can end. The end of input gives an empty answer. */
export function readAnswer(input: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve) => {
    const reader = createInterface({ input });
    reader.once("line", (line) => {
      resolve(line);
      reader.close();
    });
    reader.once("close", () => resolve(""));
  });
}
