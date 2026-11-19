import { describe, expect, it } from "vitest";
import { RefusedArgumentError } from "../../src/tracker/errors.js";
import { checkStateName, forgeStateKind, jiraStateKind, linearStateKind } from "../../src/tracker/states.js";

describe("forge state kinds", () => {
  it("an open issue with the label in review is in-progress, not finished", () => {
    expect(forgeStateKind({ open: true, labels: ["in review"] })).toBe("in-progress");
  });
  it("compares labels without case", () => {
    expect(forgeStateKind({ open: true, labels: ["In Progress"] })).toBe("in-progress");
  });
  it("an open issue without those labels is todo", () => {
    expect(forgeStateKind({ open: true, labels: ["bug"] })).toBe("todo");
  });
  it("a closed issue is finished whatever the labels", () => {
    expect(forgeStateKind({ open: false, labels: ["in progress"] })).toBe("finished");
  });
});

describe("jira and linear state kinds", () => {
  it("maps the Jira status category by name or key", () => {
    expect(jiraStateKind("To Do")).toBe("todo");
    expect(jiraStateKind("new")).toBe("todo");
    expect(jiraStateKind("In Progress")).toBe("in-progress");
    expect(jiraStateKind("indeterminate")).toBe("in-progress");
    expect(jiraStateKind("Done")).toBe("finished");
    expect(jiraStateKind("done")).toBe("finished");
    expect(jiraStateKind("Weird")).toBe("unknown");
  });
  it("maps the Linear state type", () => {
    for (const t of ["triage", "backlog", "unstarted"]) expect(linearStateKind(t)).toBe("todo");
    expect(linearStateKind("started")).toBe("in-progress");
    expect(linearStateKind("completed")).toBe("finished");
    expect(linearStateKind("canceled")).toBe("finished");
    expect(linearStateKind("other")).toBe("unknown");
  });
});

describe("checkStateName", () => {
  it("accepts in progress and in review on GitHub and GitLab", () => {
    expect(() => checkStateName("github", "in progress")).not.toThrow();
    expect(() => checkStateName("gitlab", "in review")).not.toThrow();
  });
  it("refuses any other name on a forge and lists the offered names", () => {
    expect(() => checkStateName("github", "done")).toThrow(RefusedArgumentError);
    expect(() => checkStateName("github", "done")).toThrow(/in progress, in review/);
  });
  it("refuses a name the tracker does not offer, and lists the offered names", () => {
    expect(() => checkStateName("jira", "Nope", ["To Do", "Done"])).toThrow(/To Do, Done/);
    expect(() => checkStateName("linear", "Done", ["To Do", "Done"])).not.toThrow();
  });
});
