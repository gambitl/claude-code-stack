export type Io = {
  stdout(text: string): void;
  stderr(text: string): void;
};

export const processIo: Io = {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
};

// Ends quietly when the reader of a stream closes the pipe early, as in
// `cstack ... | head -1`. Any other stream error is thrown again.
export function endQuietlyOnBrokenPipe(stream: NodeJS.WritableStream): void {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") throw error;
  });
}
