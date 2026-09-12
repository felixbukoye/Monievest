"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { emptyAuthState, signInAction, signUpAction, type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; body: string; cta: string; alt: string; altHref: string }> = {
  login: {
    title: "Welcome back",
    body: "Sign in to pick up your portfolio exactly where you left it.",
    cta: "Sign in",
    alt: "New to Monievest? Create an account",
    altHref: "/signup",
  },
  signup: {
    title: "Create your account",
    body: "Start with $25,000 in demo cash. Your watchlist, positions and history are saved to your own private account.",
    cta: "Create account",
    alt: "Already have an account? Sign in",
    altHref: "/login",
  },
};

export function AuthForm({ mode, next, configured }: { mode: Mode; next: string; configured: boolean }) {
  const [formState, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? signInAction : signUpAction,
    emptyAuthState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const copy = COPY[mode];

  function togglePassword(event: FormEvent<HTMLButtonElement>) {
    // Keep the form from submitting when the eye icon is clicked.
    event.preventDefault();
    setShowPassword((value) => !value);
  }

  return (
    <div className="w-full">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>

      {!configured && (
        <div className="mb-5 flex gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Accounts are switched off</p>
            <p className="mt-0.5 opacity-90">
              Add your Supabase URL and anon key to <code className="font-mono text-[12px]">.env.local</code>, then run the SQL in{" "}
              <code className="font-mono text-[12px]">supabase/migrations/0001_init.sql</code>. Until then the app runs as a local
              demo —{" "}
              <Link href="/app" className="font-medium underline underline-offset-2">
                open the demo
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />

        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[13px] font-medium">
              Full name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="name" name="name" type="text" autoComplete="name" placeholder="Ada Lovelace" disabled={pending} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px] font-medium">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              placeholder={mode === "login" ? "Your password" : "At least 6 characters"}
              disabled={pending}
              className="pr-10"
            />
            <button
              type="button"
              onClick={togglePassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 grid h-full w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>

        {formState.error && (
          <div
            role="alert"
            className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-[13px] leading-relaxed text-destructive"
          >
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>{formState.error}</span>
          </div>
        )}

        {formState.message && (
          <div
            role="status"
            className="flex gap-2.5 rounded-lg border border-gain-foreground/40 bg-gain-foreground/8 p-3 text-[13px] leading-relaxed text-gain-foreground"
          >
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0" />
            <span>{formState.message}</span>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full gap-2" disabled={pending}>
          {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
          {pending ? (mode === "login" ? "Signing in…" : "Creating account…") : copy.cta}
          {!pending && <ArrowRightIcon className="size-4" />}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 text-[13px]">
        <Link href={copy.altHref} className="font-medium text-primary underline-offset-4 hover:underline">
          {copy.alt}
        </Link>
        <Link href="/" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          ← Back to monievest.com
        </Link>
      </div>
    </div>
  );
}
