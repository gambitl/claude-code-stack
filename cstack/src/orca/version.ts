// The oldest Orca version that cstack supports. This is the only place that writes it.
export const MIN_ORCA_VERSION = "1.4.259";

// The newest Orca version whose answers are recorded in test/fixtures/orca/.
export const NEWEST_TESTED_ORCA_VERSION = "1.4.263";

// Takes the first <number>.<number>.<number> of the text, or null when there is none.
export function parseVersion(text: string): string | null {
  return /\d+\.\d+\.\d+/.exec(text)?.[0] ?? null;
}

// Compares part by part as numbers. Returns a negative number, 0 or a positive number.
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
