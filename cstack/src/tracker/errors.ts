import { EXIT } from "../manifest.js";

/** A tracker error that knows the exit code of the command. */
export class TrackerError extends Error {
  constructor(message: string, readonly exitCode: number) {
    super(message);
    this.name = new.target.name;
  }
}

/** A key, state name or path that cstack refuses before any program runs. */
export class RefusedArgumentError extends TrackerError {
  constructor(message: string) {
    super(message, EXIT.refused);
  }
}

/** The file that Claude wrote cannot be used. */
export class InvalidFileError extends TrackerError {
  constructor(message: string) {
    super(message, EXIT.invalidInput);
  }
}

/** No client can do this step, so Claude must do it with its own connection. */
export class NoClientError extends TrackerError {
  constructor(message: string) {
    super(message, EXIT.missingTool);
  }
  static forMove(key: string, stateName: string): NoClientError {
    return new NoClientError(`No client can move tickets. With your own connection, move ${key} to the state "${stateName}".`);
  }
  static forComment(key: string, bodyFile: string): NoClientError {
    return new NoClientError(`No client can add comments. With your own connection, add the text of ${bodyFile} as a comment on ${key}.`);
  }
  static forRead(what: string): NoClientError {
    return new NoClientError(`No client can read ${what}.`);
  }
}

/** The answer to a command that changes something has the wrong shape, so cstack cannot tell what happened. */
export class WriteShapeError extends TrackerError {
  constructor(message: string) {
    super(`${message} cstack cannot tell whether the change happened. Check the ticket or the worktree by hand.`, EXIT.toolFailed);
  }
}

/** Orca reports that it could not confirm a write. cstack never retries on its own. */
export class UnconfirmedWriteError extends TrackerError {
  constructor(readonly retryId: string) {
    super(
      `Orca could not confirm the change. The retry id is ${retryId}. Check the ticket by hand before you try again. cstack does not retry on its own.`,
      EXIT.toolFailed,
    );
  }
}
