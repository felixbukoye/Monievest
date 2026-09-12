"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServer } from "@/lib/supabase/server";

export type AuthFormState = {
  error: string | null;
  message: string | null;
  /** True when sign-up succeeded but the email still needs confirming. */
  needsConfirmation: boolean;
};

export const emptyAuthState: AuthFormState = { error: null, message: null, needsConfirmation: false };

const NOT_CONFIGURED = "Accounts are not configured on this deployment — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.";

/** Only allow same-origin paths, so `?next=` can never be an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/app";
  return raw;
}

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? headerStore.get("referer") ?? "";
  return origin.replace(/\/$/, "");
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

export async function signInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ...emptyAuthState, error: NOT_CONFIGURED };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) return { ...emptyAuthState, error: "Enter both your email and password." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ...emptyAuthState, error: friendlyMessage(error.message) };

  redirect(next);
}

export async function signUpAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { ...emptyAuthState, error: NOT_CONFIGURED };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(formData.get("next"));

  if (!email.includes("@")) return { ...emptyAuthState, error: "Enter a valid email address." };
  if (password.length < 6) return { ...emptyAuthState, error: "Choose a password with at least 6 characters." };

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

  if (error) return { ...emptyAuthState, error: friendlyMessage(error.message) };

  // Email confirmation is ON in the project: no session yet.
  if (!data.session) {
    return {
      error: null,
      message: `Account created. We sent a confirmation link to ${email} — open it, then sign in here.`,
      needsConfirmation: true,
    };
  }

  redirect(next);
}

/** Server-side sign out (the topbar uses the client sign-out for speed). */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServer();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
