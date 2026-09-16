"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServer } from "@/lib/supabase/server";
import { emptyAuthState, type AuthFormState } from "./form-state";

const NOT_CONFIGURED = "Accounts are not configured on this deployment — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.";

/**
 * Server actions must never throw — anything unexpected is turned into a
 * friendly form state, so a network blip surfaces as a message instead of a
 * 500. `redirect()` is always called outside the try/catch, so a successful
 * sign-in is never swallowed by the catch.
 */
const UNEXPECTED_SIGN_IN_ERROR = "Something went wrong while signing you in. Try again in a moment.";
const UNEXPECTED_SIGN_UP_ERROR = "Something went wrong while creating your account. Try again in a moment.";

const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_PASSWORD_LENGTH = 100; // well past bcrypt's 72-byte input window, short enough to stay sane
const MAX_NAME_LENGTH = 100;

/** Loose email check for the UI; Supabase enforces the real rules on the server. */
function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Read a text field from FormData. Non-string values (files, null) become "". */
function formField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Only allow same-origin paths, so `?next=` can never be an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/app";
  return raw;
}

/**
 * Where a confirmation email should send the user back to.
 *
 * The request's own Origin wins, so a deployment behind a proxy (or a dev
 * preview on a different host) links to the URL the person is actually using.
 * The Referer is only used as an origin (never its path), and
 * `NEXT_PUBLIC_APP_URL` is the fallback when the request carries neither.
 * Whatever we send must also be listed in Supabase → Authentication → URL
 * Configuration, otherwise Supabase falls back to the project's Site URL.
 */
async function siteOrigin(): Promise<string> {
  const headerStore = await headers();

  const origin = headerStore.get("origin");
  if (origin && origin !== "null" && /^https?:\/\//.test(origin)) return origin.replace(/\/+$/, "");

  const referer = headerStore.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // Referer wasn't an absolute URL — fall through to the env fallback.
    }
  }

  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return "";
}

/** Turn Supabase's developer-facing messages into something a person can act on. */
function friendlyMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "That email and password don't match. Check them and try again.";
  if (lower.includes("email not confirmed")) return "That email address isn't confirmed yet — open the verification link we sent you.";
  if (lower.includes("already registered") || lower.includes("already been registered"))
    return "An account with that email already exists. Try signing in instead.";
  if (lower.includes("password should be at least")) return "Passwords need to be at least 6 characters long.";
  if (lower.includes("unable to validate email") || lower.includes("invalid email")) return "That doesn't look like a valid email address.";
  if (lower.includes("rate limit") || lower.includes("too many requests")) return "Too many attempts — wait a minute and try again.";
  if (lower.includes("email rate limit")) return "Supabase is rate-limiting confirmation emails. Wait a minute, then try again.";
  if (lower.includes("captcha")) return "Sign-up was blocked by the project's CAPTCHA settings. Turn off 'Require CAPTCHA' in Supabase → Auth, or sign in instead.";
  if (lower.includes("failed to fetch") || lower.includes("fetch failed") || lower.includes("timeout"))
    return "Could not reach Supabase. Check the project URL in .env.local and that the project is active.";
  return message;
}

/** Outcome of an auth attempt: either a form state to show, or a success to redirect on. */
type AuthOutcome = { success: boolean; state: AuthFormState };

export async function signInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeNext(formData.get("next"));

  let outcome: AuthOutcome;
  try {
    outcome = await runSignIn(formData);
  } catch {
    outcome = { success: false, state: { ...emptyAuthState, error: UNEXPECTED_SIGN_IN_ERROR } };
  }

  if (outcome.success) redirect(next);
  return outcome.state;
}

async function runSignIn(formData: FormData): Promise<AuthOutcome> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { success: false, state: { ...emptyAuthState, error: NOT_CONFIGURED } };

  const email = formField(formData, "email").trim();
  const password = formField(formData, "password");

  if (!isValidEmail(email)) return { success: false, state: { ...emptyAuthState, error: "Enter a valid email address." } };
  if (!password) return { success: false, state: { ...emptyAuthState, error: "Enter your password." } };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, state: { ...emptyAuthState, error: friendlyMessage(error.message) } };

  return { success: true, state: { ...emptyAuthState } };
}

export async function signUpAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeNext(formData.get("next"));

  let outcome: AuthOutcome;
  try {
    outcome = await runSignUp(formData);
  } catch {
    outcome = { success: false, state: { ...emptyAuthState, error: UNEXPECTED_SIGN_UP_ERROR } };
  }

  if (outcome.success) redirect(next);
  return outcome.state;
}

async function runSignUp(formData: FormData): Promise<AuthOutcome> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { success: false, state: { ...emptyAuthState, error: NOT_CONFIGURED } };

  const email = formField(formData, "email").trim();
  const password = formField(formData, "password");
  const name = formField(formData, "name").trim().slice(0, MAX_NAME_LENGTH);

  if (!isValidEmail(email)) return { success: false, state: { ...emptyAuthState, error: "Enter a valid email address." } };
  if (password.length < 6) return { success: false, state: { ...emptyAuthState, error: "Choose a password with at least 6 characters." } };
  if (password.length > MAX_PASSWORD_LENGTH)
    return { success: false, state: { ...emptyAuthState, error: `Keep your password under ${MAX_PASSWORD_LENGTH} characters.` } };

  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // `handle_new_user()` in the migration reads this to build the profile.
      data: name ? { display_name: name } : {},
      emailRedirectTo: origin ? `${origin}/app` : undefined,
    },
  });

  if (error) return { success: false, state: { ...emptyAuthState, error: friendlyMessage(error.message) } };

  // Email confirmation is ON in the project: no session yet.
  if (!data.session) {
    return {
      success: false,
      state: {
        error: null,
        message: `Account created. We sent a confirmation link to ${email} — open it, then sign in here.`,
        needsConfirmation: true,
      },
    };
  }

  return { success: true, state: { ...emptyAuthState } };
}

/** Server-side sign out (the topbar uses the client sign-out for speed). */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createSupabaseServer();
    if (supabase) await supabase.auth.signOut();
  } catch {
    // Even if the sign-out call fails (no session cookie, network blip),
    // sending the user back home is still the right outcome.
  }
  redirect("/");
}
