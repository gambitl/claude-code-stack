import { hostname, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { recordOrca } from "../dist/orca/record.js";
import { createRunner } from "../dist/orca/run.js";

const folder = fileURLToPath(new URL("../test/fixtures/orca", import.meta.url));
const written = await recordOrca({
  run: createRunner(60_000),
  env: process.env,
  folder,
  home: homedir(),
  host: hostname(),
});
console.log(`Recorded ${written.length} files: ${written.join(", ")}`);
