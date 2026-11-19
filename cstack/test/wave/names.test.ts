import { describe, expect, it } from "vitest";
import { RefusedArgumentError } from "../../src/tracker/errors.js";
import { runTicketId, shortName } from "../../src/wave/names.js";

describe("shortName", () => {
  it("lowercases a board key", () => {
    expect(shortName("jira", "ABC-12")).toBe("abc-12");
    expect(shortName("linear", "ABC-12")).toBe("abc-12");
  });
  it("names a forge ticket issue-<n>", () => {
    expect(shortName("github", "#12")).toBe("issue-12");
    expect(shortName("gitlab", "#12")).toBe("issue-12");
  });
  it("refuses a key that is not valid", () => {
    expect(() => shortName("github", "ABC-12")).toThrow(RefusedArgumentError);
    expect(() => shortName("jira", "../x")).toThrow(RefusedArgumentError);
  });
});

describe("runTicketId", () => {
  it("drops the # of a forge key and keeps a board key", () => {
    expect(runTicketId("github", "#29")).toBe("29");
    expect(runTicketId("gitlab", "#29")).toBe("29");
    expect(runTicketId("jira", "ABC-12")).toBe("ABC-12");
  });
  it("refuses a key that is not valid", () => {
    expect(() => runTicketId("linear", "#1")).toThrow(RefusedArgumentError);
  });
});
