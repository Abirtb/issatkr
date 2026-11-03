import { z } from "zod";

// bcrypt only uses the first 72 bytes: anything longer would be silently ignored,
// so longer passwords are refused instead (bytes, not characters: é is 2 bytes).
export const MAX_PASSWORD_BYTES = 72;
export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Mot de passe : ${MIN_PASSWORD_LENGTH} caractères minimum`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Mot de passe : ${MAX_PASSWORD_BYTES} octets maximum`;
  }
  return null;
}

export const newPasswordField = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});
