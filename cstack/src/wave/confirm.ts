/** True only for `y` and `yes`, in any case, after trimming. Anything else, even an empty answer, means no. */
export function isYes(answer: string): boolean {
  return ["y", "yes"].includes(answer.trim().toLowerCase());
}
