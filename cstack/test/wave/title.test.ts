import { describe, expect, it } from "vitest";
import { printableText, printableTitle } from "../../src/wave/title.js";

describe("printableTitle", () => {
  it("prints one clean line of exactly 80 characters ending with an ellipsis", () => {
    const raw =
      "\u001b[2J\u001b]0;evil\u0007Fix\u202e login " + "a".repeat(100) + "\nsecond line";
    const out = printableTitle(raw);
    expect(out).toHaveLength(80);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u202e]/);
    expect(out).not.toContain("second");
    expect(out.startsWith("Fix login")).toBe(true);
  });

  it("keeps a short title as it is, trimmed", () => {
    expect(printableTitle("  Hello  ")).toBe("Hello");
  });
});

describe("printableText", () => {
  it("removes CSI and OSC sequences in both forms and the bidi controls", () => {
    expect(printableText("a\u009b31mb\u009d0;x\u001b\\c\u001b]0;y\u0007d⁦e‏")).toBe("abcde");
  });
  it("removes C0, DEL and C1 characters", () => {
    expect(printableText("a\u0000b\u007fc\u0085d")).toBe("abcd");
  });
});
