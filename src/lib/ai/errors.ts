/** An AI failure with a message that is safe to show the student, plus an HTTP status. */
export class AIError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
