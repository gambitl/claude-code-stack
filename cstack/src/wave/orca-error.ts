import { printableText } from "./title.js";

/** The message of an Orca `{"ok":false,"error":{...}}` answer, or undefined when the text is not one. */
export function orcaErrorMessage(stdout: string | undefined): string | undefined {
  if (!stdout) return undefined;
  try {
    const answer = JSON.parse(stdout);
    if (answer?.ok !== false) return undefined;
    const message = answer.error?.message;
    return printableText(typeof message === "string" && message !== "" ? message : "no message").trim();
  } catch {
    return undefined;
  }
}

/** True when the message talks about a retry or a launch, so Orca may have started the work anyway. */
export function mentionsLaunch(message: string): boolean {
  return /retry|launch/i.test(message);
}
