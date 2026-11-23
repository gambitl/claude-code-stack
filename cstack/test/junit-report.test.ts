import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

async function load() {
  return await import("../src/junit-report.js");
}

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/junit/${name}`, import.meta.url)), "utf8");
}

function wrap(...cases: string[]): string {
  return `<testsuites>${cases.join("")}</testsuites>`;
}

async function refusal(xml: string): Promise<string> {
  const { readJUnitReport, ReportError } = await load();
  try {
    readJUnitReport(xml);
  } catch (e) {
    expect(e).toBeInstanceOf(ReportError);
    return (e as Error).message;
  }
  throw new Error("the reader accepted the report");
}

describe("readJUnitReport", () => {
  it("reads the pytest fixture into a passed, a failed, an error and a skipped case", async () => {
    const { readJUnitReport } = await load();
    expect(readJUnitReport(fixture("pytest.xml"))).toEqual([
      { name: "test_adds_item", classname: "tests.test_cart.TestCart", file: "tests/test_cart.py", outcome: "passed" },
      { name: "test_removes_item", classname: "tests.test_cart.TestCart", outcome: "failed" },
      { name: "test_total", classname: "tests.test_cart.TestCart", outcome: "error" },
      { name: "test_later", classname: "tests.test_cart.TestCart", outcome: "skipped" },
    ]);
  });

  it("reads the vitest fixture with names that hold ' > ' and decoded entities", async () => {
    const { readJUnitReport } = await load();
    const cases = readJUnitReport(fixture("vitest.xml"));
    expect(cases.map((c) => c.name)).toEqual([
      "parser > reads a <tag> & more",
      "parser > says \"no\" and 'yes'",
      "parser > is skipped",
      "parser > is a todo",
    ]);
    expect(cases.map((c) => c.outcome)).toEqual(["passed", "failed", "skipped", "skipped"]);
    expect(cases[0].classname).toBe("test/sample.test.ts");
  });

  it("reads a case with both a failure and an error as error", async () => {
    const { readJUnitReport } = await load();
    const xml = wrap('<testcase name="a"><failure message="x"/><error message="y"/></testcase>');
    expect(readJUnitReport(xml)).toEqual([{ name: "a", outcome: "error" }]);
  });

  it("does not let other child elements change the outcome", async () => {
    const { readJUnitReport } = await load();
    const xml = wrap('<testcase name="a"><system-out>hi</system-out><properties><property name="k" value="v"/></properties></testcase>');
    expect(readJUnitReport(xml)).toEqual([{ name: "a", outcome: "passed" }]);
  });

  it("finds cases in a nested testsuite", async () => {
    const { readJUnitReport } = await load();
    const xml = wrap('<testsuite name="o"><testsuite name="i"><testcase name="deep"/></testsuite></testsuite>');
    expect(readJUnitReport(xml)).toEqual([{ name: "deep", outcome: "passed" }]);
  });

  it("finds cases under a testsuite root", async () => {
    const { readJUnitReport } = await load();
    expect(readJUnitReport('<testsuite name="s"><testcase name="a"/></testsuite>')).toEqual([{ name: "a", outcome: "passed" }]);
  });

  it("keeps two cases with the same name as two entries", async () => {
    const { readJUnitReport } = await load();
    const xml = wrap('<testcase name="same"/>', '<testcase name="same"><failure/></testcase>');
    expect(readJUnitReport(xml).map((c) => c.outcome)).toEqual(["passed", "failed"]);
  });

  it("decodes numeric references", async () => {
    const { readJUnitReport } = await load();
    expect(readJUnitReport(wrap('<testcase name="a&#10;b&#x41;"/>'))[0].name).toBe("a\nbA");
  });

  it("skips the XML declaration, a processing instruction and a comment", async () => {
    const { readJUnitReport } = await load();
    const xml = '<?xml version="1.0"?>\n<!-- c -->\n<?pi data?>\n<testsuites><!-- in --><testcase name="a"/></testsuites>\n<!-- end -->\n';
    expect(readJUnitReport(xml)).toEqual([{ name: "a", outcome: "passed" }]);
  });

  it("reads a CDATA section as text and does not take a tag inside it", async () => {
    const { readJUnitReport } = await load();
    const xml = wrap('<testcase name="a"><failure><![CDATA[<testcase name="fake"/> & more]]></failure></testcase>');
    expect(readJUnitReport(xml)).toEqual([{ name: "a", outcome: "failed" }]);
  });

  it("keeps file when the report writes it", async () => {
    const { readJUnitReport } = await load();
    expect(readJUnitReport(wrap('<testcase name="a" file="x/y.py"/>'))[0].file).toBe("x/y.py");
  });

  it("returns an empty list for a report with no case", async () => {
    const { readJUnitReport } = await load();
    expect(readJUnitReport('<testsuites name="empty"></testsuites>')).toEqual([]);
    expect(readJUnitReport('<testsuites/>')).toEqual([]);
  });
});

describe("readJUnitReport refusals", () => {
  it("refuses an empty text", async () => {
    expect(await refusal("")).toMatch(/empty/i);
  });

  it("refuses an unclosed tag", async () => {
    expect(await refusal('<testsuites><testcase name="a"/>')).toMatch(/unclosed|not closed/i);
  });

  it("refuses an end tag that does not match and names its line", async () => {
    const message = await refusal('<testsuites>\n<testcase name="a">\n</testsuite>\n</testsuites>');
    expect(message).toMatch(/line 3/);
    expect(message).toMatch(/does not match/i);
  });

  it("refuses text outside the root", async () => {
    expect(await refusal('<testsuites/>\nstray')).toMatch(/outside the root/i);
  });

  it("refuses a DOCTYPE", async () => {
    expect(await refusal('<!DOCTYPE x [<!ENTITY a "b">]><testsuites/>')).toMatch(/DOCTYPE/);
  });

  it("refuses an unknown named entity", async () => {
    expect(await refusal(wrap('<testcase name="&nbsp;"/>'))).toMatch(/&nbsp;/);
  });

  it("refuses a reference to a code point that XML forbids", async () => {
    expect(await refusal(wrap('<testcase name="a&#0;b"/>'))).toMatch(/not allowed|forbid/i);
  });

  it("refuses a root that is neither testsuites nor testsuite", async () => {
    expect(await refusal('<report/>')).toMatch(/root/i);
  });

  it("refuses a testcase without name", async () => {
    expect(await refusal(wrap('<testcase classname="c"/>'))).toMatch(/name/);
  });

  it("escapes control characters and cuts a very long value in its message", async () => {
    const long = await refusal(`<testsuites></${"x".repeat(500)}>`);
    expect(long).toContain("...");
    expect(long.length).toBeLessThan(250);
    const ctl = await refusal("<testsuites></a\u0085b>");
    expect(ctl).not.toContain("\u0085");
    expect(ctl).toContain("\\u0085");
  });
});
