import type { Runner } from "../orca/run.js";

// WHY: the script lines are fixed text. The ticket key reaches AppleScript only as an argument that `on run argv` reads, so no text from a ticket is ever parsed as script.
const SCRIPT = ["-e", "on run argv", "-e", 'display notification (item 1 of argv) with title "cstack"', "-e", "end run"];

/** Shows a macOS notification for a ready ticket. It answers false when the notification did not run. */
export async function notifyReady(run: Runner, key: string): Promise<boolean> {
  const result = await run("/usr/bin/osascript", [...SCRIPT, `Ticket ${key} is ready. Answer in the cstack terminal.`]);
  return result.kind === "ok";
}
