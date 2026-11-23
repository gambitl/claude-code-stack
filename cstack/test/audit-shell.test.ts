import { describe, expect, it } from "vitest";
import { cstackCommands } from "../src/audit/shell.js";

describe("cstackCommands", () => {
  it("returns one list per command joined by &&, in order", () => {
    expect(cstackCommands("cstack a 1 && cstack b 2")).toEqual([["a", "1"], ["b", "2"]]);
  });
  it.each([";", "||", "|", "\n", "&"])("splits on %j", (sep) => {
    expect(cstackCommands(`cstack a ${sep} cstack b`)).toEqual([["a"], ["b"]]);
  });
  it("skips a leading assignment", () => {
    expect(cstackCommands("CSTACK_ORCA_WORKERS=off cstack next")).toEqual([["next"]]);
  });
  it("removes quotes from words", () => {
    expect(cstackCommands("cstack x '#89' --to \"in progress\"")).toEqual([["x", "#89", "--to", "in progress"]]);
  });
  it("ignores text that is not a call", () => {
    expect(cstackCommands('echo "cstack next --done plan"')).toEqual([]);
    expect(cstackCommands("node cstack/dist/bin.js next")).toEqual([]);
  });
  it("skips heredoc bodies and finds the command after", () => {
    const c = "cat <<EOF\ncstack unit red 2\nEOF\ncstack next";
    expect(cstackCommands(c)).toEqual([["next"]]);
    expect(cstackCommands("cat <<-'EOF'\n\tcstack a\n\tEOF\ncstack b")).toEqual([["b"]]);
    expect(cstackCommands('cat <<"X"\ncstack a\nX\ncstack b')).toEqual([["b"]]);
  });
  it("drops redirections", () => {
    expect(cstackCommands("cstack unit green 1 2>&1 | tail -5")).toEqual([["unit", "green", "1"]]);
    expect(cstackCommands("cstack publish > out.txt")).toEqual([["publish"]]);
    expect(cstackCommands("cstack publish >out.txt")).toEqual([["publish"]]);
  });
  it("finds a command inside $(...)", () => {
    expect(cstackCommands("P=$(cstack plan section Decisions)")).toEqual([["plan", "section", "Decisions"]]);
  });
  it("ignores comments", () => {
    expect(cstackCommands("# cstack next")).toEqual([]);
    expect(cstackCommands("cstack a # cstack b\ncstack c")).toEqual([["a"], ["c"]]);
  });
  it("joins a backslash-newline", () => {
    expect(cstackCommands("cstack a \\\n  b")).toEqual([["a", "b"]]);
  });
  it("keeps variable words and skips keywords", () => {
    expect(cstackCommands("cstack unit red $n")).toEqual([["unit", "red", "$n"]]);
    expect(cstackCommands("if cstack a; then cstack b; fi")).toEqual([["a"], ["b"]]);
  });
});
