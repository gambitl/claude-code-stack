# ADR-SIC-H: How a cstack command starts and ends

Status: accepted, 2026-11-17.
Ticket: https://github.com/gambitl/claude-code-stack/issues/7

## Context

`cstack` is a command-line tool written in TypeScript for Node. Agents and people run it, and agents often read its output through a pipe. Later tickets add many commands, and each one needs tests. Tests are much simpler when they can call the code directly and do not need to start a new process.

## Options

1. Put everything in one file that is both the entry point and the code. A test then has to start a process, or the file has to check whether it was started as the command. That check fails when npm starts the command through a symbolic link, and the command then does nothing and says nothing.
2. Use a separate entry file, `src/bin.ts`, that only connects the process to an asynchronous function, `run(args, io)`. The function prints through an `io` argument and returns an exit code. Tests call `run` with a fake `io`.
3. Call `process.exit()` with the exit code at the end of each command. This is short, but it is not safe, as the next section shows.

## Decision

We use option 2.

- `src/bin.ts` is the only file that touches the process. It starts with `#!/usr/bin/env node`, calls `run`, and sets `process.exitCode`. If `run` throws, it prints one line, `cstack: <message>`, with no stack trace, and sets exit code 1.
- `run` is asynchronous, because later commands run other programs and read files.
- A usage error returns exit code 2. A crash gives exit code 1.
- No code calls `process.exit()`. On macOS, `process.exit()` cut the output of a script piped into `wc -c` at 65,536 bytes out of 1,000,001.
- `tsconfig.build.json` sets `rootDir` to `src`. Without it, TypeScript 7 can silently write `dist/src/bin.js`, and the `bin` entry of `package.json` then points at a missing file.
- `cstack` reads its version at run time from `package.json`, and does not import it as JSON.

## Consequences

Tests are fast and never start a process. Every later command follows the same shape: it prints through `io` and returns its exit code. The only part that tests cannot reach is `bin.ts`, so the CI workflow runs `node dist/bin.js --version` on every pull request. If the program that reads the output closes the pipe early, `bin.ts` ends quietly. It ignores the broken pipe error (`EPIPE`) on standard output and throws every other stream error again. `bin.ts` stays the only file that touches the process.
