import { readFileSync } from "node:fs";
import type { Io } from "../io.js";
import { requirements, type DoctorInput } from "../doctor/requirements.js";
import { createRunner, findOnPath } from "../doctor/runner.js";

const TIMEOUT_MS = 5000;

function realInput(): DoctorInput {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { engines: { node: string } };
  return {
    run: createRunner(TIMEOUT_MS),
    timeoutMs: TIMEOUT_MS,
    nodeVersion: process.versions.node,
    enginesNode: pkg.engines.node,
    findOnPath: (command) => findOnPath(command, process.env.PATH ?? ""),
  };
}

export async function doctor(
  io: Io,
  input: DoctorInput = realInput(),
): Promise<number> {
  let needAttention = 0;
  for (const item of requirements) {
    const outcome = await item.check(input, item.install);
    if (!outcome.ok && item.required) needAttention++;
    const label = item.required ? item.name : `${item.name} (optional)`;
    io.stdout(`${label}: ${outcome.text}\n`);
  }
  io.stdout(
    needAttention === 0
      ? "Every required item is present.\n"
      : `${needAttention} required ${needAttention === 1 ? "item needs" : "items need"} attention.\n`,
  );
  return needAttention === 0 ? 0 : 1;
}
