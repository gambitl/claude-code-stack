import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { endQuietlyOnBrokenPipe } from "../src/io.js";

function errorWithCode(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`write ${code}`), { code });
}

describe("endQuietlyOnBrokenPipe", () => {
  it("ignores an EPIPE error", () => {
    const stream = new PassThrough();
    endQuietlyOnBrokenPipe(stream);
    expect(() => stream.emit("error", errorWithCode("EPIPE"))).not.toThrow();
  });

  it("rethrows an error with another code", () => {
    const stream = new PassThrough();
    endQuietlyOnBrokenPipe(stream);
    expect(() => stream.emit("error", errorWithCode("EACCES"))).toThrow("write EACCES");
  });
});
