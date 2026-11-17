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
