import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readPublishRecord,
  readTestMarker,
  removeTestMarker,
  writePublishRecord,
  writeTestMarker,
} from "../src/publish/record.js";
import { checkReport } from "../src/report/reports.js";
import { runFolder } from "../src/run-state.js";
import { commitPlan, git, makeRepo } from "./helpers/plan-repo.js";
import { readFileSync } from "node:fs";

const full = readFileSync(new URL("./fixtures/plans/full.md", import.meta.url), "utf8");
const PLAN = "docs/plans/full.md";

function setup() {
  const dir = makeRepo();
  commitPlan(dir, full);
  const folder = runFolder(dir, PLAN);
  return { dir, folder, head: git(dir, "rev-parse", "HEAD"), where: { root: dir, planFile: PLAN } };
}

describe("publish.json", () => {
  it("keeps the link, every push in order and the checks", () => {
    const { folder } = setup();
    const record = {
      pullRequest: "https://github.com/o/r/pull/1",
      pushes: [
        { commit: "a".repeat(40), time: "2026-11-19T10:00:00Z" },
        { commit: "b".repeat(40), time: "2026-11-19T11:00:00Z" },
      ],
      checks: "all passed",
    };
    writePublishRecord(folder, record);
    expect(readPublishRecord(folder)).toEqual(record);
  });

  it("is accepted by the published report only with a link and HEAD as the last push", () => {
    const { folder, head, where } = setup();
    const published = { role: "executor", kind: "published", text: "" } as const;
    const push = [{ commit: head, time: "2026-11-19T10:00:00Z" }];
    writePublishRecord(folder, { pullRequest: "", pushes: push });
    expect(checkReport(published, where)).not.toEqual([]);
    writePublishRecord(folder, { pullRequest: "https://github.com/o/r/pull/1", pushes: push });
    expect(checkReport(published, where)).toEqual([]);
  });

  it("returns undefined when missing and throws on invalid JSON", () => {
    const { folder } = setup();
    expect(readPublishRecord(folder)).toBeUndefined();
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "publish.json"), "nope");
    expect(() => readPublishRecord(folder)).toThrow(/JSON/);
  });
});

describe("publish-tests.json", () => {
  it("writes, reads and removes the marker, and removing a missing one does nothing", () => {
    const { folder } = setup();
    expect(readTestMarker(folder)).toBeUndefined();
    removeTestMarker(folder);
    const marker = { commit: "c".repeat(40), time: "2026-11-19T12:00:00Z" };
    writeTestMarker(folder, marker);
    expect(readTestMarker(folder)).toEqual(marker);
    removeTestMarker(folder);
    expect(readTestMarker(folder)).toBeUndefined();
  });
});
