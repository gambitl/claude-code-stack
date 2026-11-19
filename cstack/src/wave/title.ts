// Cleans text from a tracker or from Orca before cstack prints it.
// These functions never print and never read anything.

const CSI = /(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]/g;
const OSC = /(?:\u001b\]|\u009d)[\s\S]*?(?:\u0007|\u001b\\|$)/g;
const CONTROLS = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

const MAX_TITLE = 80;

export function printableText(text: string): string {
  return text.replace(OSC, "").replace(CSI, "").replace(CONTROLS, "");
}

export function printableTitle(text: string): string {
  const firstLine = text.split(/\r\n|[\n\r\u2028\u2029]/)[0] ?? "";
  const clean = printableText(firstLine).trim();
  const chars = Array.from(clean);
  if (chars.length <= MAX_TITLE) return clean;
  return `${chars.slice(0, MAX_TITLE - 1).join("")}…`;
}
