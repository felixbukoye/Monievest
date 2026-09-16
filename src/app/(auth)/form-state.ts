/**
 * Shared state for the sign-in / sign-up forms.
 *
 * This must NOT live in `actions.ts`: a `"use server"` module can only export
 * async functions, and exporting a plain value like `emptyAuthState` from it
 * makes the whole module fail to load (Next.js `invalid-use-server-value`),
 * which 500s every form submission on the page.
 */
export type AuthFormState = {
  error: string | null;
  message: string | null;
  /** True when sign-up succeeded but the email still needs confirming. */
  needsConfirmation: boolean;
};

export const emptyAuthState: AuthFormState = {
  error: null,
  message: null,
  needsConfirmation: false,
};
