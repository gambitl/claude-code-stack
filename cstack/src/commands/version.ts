import { readFileSync } from "node:fs";
import type { Io } from "../io.js";

export async function version(io: Io): Promise<number> {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  io.stdout(`${pkg.version}\n`);
  return 0;
}
