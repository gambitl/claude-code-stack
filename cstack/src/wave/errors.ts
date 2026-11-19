/** A failure of the wave that already knows the exit code of the command. */
export class WaveError extends Error {
  constructor(message: string, readonly exitCode: number) {
    super(message);
    this.name = "WaveError";
  }
}
