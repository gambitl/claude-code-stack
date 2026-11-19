// WHY: ADR-SIC-B. `publish.json` and the test marker live in the run folder. They are read and written here, so `src/run-state.ts` stays as it is.
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { RunStateError, writeFileAtomic, type PublishRecord } from "../run-state.js";

/** `publish-tests.json`: the tests failed after the branch was updated, so the next run tests again before any push. */
export interface TestMarker {
  commit: string;
  time: string;
}

function readJson<T>(path: string): T | undefined {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new RunStateError(`The file ${path} cannot be read.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RunStateError(`The file ${path} is not valid JSON.`);
  }
}

const writeJson = (path: string, value: unknown) => writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);

export const readPublishRecord = (folder: string) => readJson<PublishRecord>(join(folder, "publish.json"));

export const writePublishRecord = (folder: string, record: PublishRecord) =>
  writeJson(join(folder, "publish.json"), record);

export const readTestMarker = (folder: string) => readJson<TestMarker>(join(folder, "publish-tests.json"));

export const writeTestMarker = (folder: string, marker: TestMarker) =>
  writeJson(join(folder, "publish-tests.json"), marker);

export const removeTestMarker = (folder: string) => rmSync(join(folder, "publish-tests.json"), { force: true });
