"use client";

import { BugIcon, CheckCircle2Icon, LightbulbIcon, MessageSquareIcon, SendIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { usePortfolio } from "@/lib/store/provider";

const CATEGORIES = [
  { id: "bug", label: "Bug report", icon: BugIcon, hint: "Something is broken or looks wrong" },
  { id: "feedback", label: "Feedback", icon: MessageSquareIcon, hint: "General thoughts on the app" },
  { id: "feature", label: "Feature idea", icon: LightbulbIcon, hint: "Something you'd like to see" },
] as const;

type MyFeedback = {
  id: string;
  category: string;
  message: string;
  status: "open" | "replied" | "closed";
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export function FeedbackView() {
  const { auth } = usePortfolio();
  const configured = isSupabaseConfigured();
  const signedIn = auth.status === "authenticated";

  const [category, setCategory] = React.useState<string>("feedback");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [mine, setMine] = React.useState<MyFeedback[]>([]);
  const [loadedMine, setLoadedMine] = React.useState(false);

  React.useEffect(() => {
    if (!signedIn || !configured) return;
    const client = getSupabaseBrowser();
    if (!client) return;
    let cancelled = false;

    void client
      .from("feedback")
      .select("id,category,message,status,admin_reply,replied_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMine(data as MyFeedback[]);
        setLoadedMine(true);
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, configured]);

  async function submit() {
    const text = message.trim();
    if (text.length < 5) {
      toast.error("Tell us a little more — at least a sentence.");
      return;
    }
    const client = getSupabaseBrowser();
    if (!client || !auth.userId) return;

    setSending(true);
    const { error } = await client.from("feedback").insert({
      user_id: auth.userId,
      email: auth.email,
      category,
      message: text,
    });
    setSending(false);

    if (error) {
      toast.error("Could not send your feedback", {
        description: error.message.includes("feedback")
          ? "The feedback table is missing — run migration 0002_admin.sql in Supabase."
          : error.message,
      });
      return;
    }

    setMessage("");
    setMine((current) => [
      {
        id: `local-${Date.now()}`,
        category,
        message: text,
        status: "open",
        admin_reply: null,
        replied_at: null,
        created_at: new Date().toISOString(),
      },
      ...current,
    ]);
    toast.success("Feedback sent — thank you!", {
      description: "The team reads every message. Replies appear on this page.",
    });
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight">Support</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
          Found a bug, or an idea to make Monievest better? Send it over — it lands directly in the
          team&apos;s inbox.
        </p>
      </div>

      {!configured || !signedIn ? (
        <Card className="card-soft max-w-xl">
          <CardContent className="pt-6">
            <p className="text-sm font-medium">
              {!configured
                ? "Accounts aren't configured on this deployment."
                : auth.status === "loading"
                  ? "Checking your session…"
                  : "Sign in to send feedback."}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {!configured
                ? "Feedback is stored in Supabase — add the Supabase env vars to enable it."
                : "Your message is attached to your account so the team can reply."}
            </p>
            {!configured || auth.status !== "guest" ? null : (
              <Button asChild size="sm" className="mt-3">
                <a href="/login?next=/app/feedback">Sign in</a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="card-soft lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-[15px]">Send a message</CardTitle>
              <CardDescription>Pick a category, describe the issue, hit send.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {CATEGORIES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setCategory(option.id)}
                    className={
                      category === option.id
                        ? "rounded-xl border border-primary/50 bg-primary/8 px-3 py-2.5 text-left transition-colors"
                        : "rounded-xl border border-border/70 px-3 py-2.5 text-left transition-colors hover:border-primary/30"
                    }
                  >
                    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                      <option.icon className="size-3.5" />
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.hint}</span>
                  </button>
                ))}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="feedback-message">Message</Label>
                <Textarea
                  id="feedback-message"
                  rows={5}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={
                    category === "bug"
                      ? "What happened, what did you expect, and how can we reproduce it?"
                      : "Tell us what's on your mind…"
                  }
                  maxLength={4000}
                />
                <p className="text-right text-[10.5px] text-muted-foreground">{message.length}/4000</p>
              </div>

              <Button onClick={() => void submit()} disabled={sending} className="gap-1.5">
                <SendIcon />
                {sending ? "Sending…" : "Send feedback"}
              </Button>
            </CardContent>
          </Card>

          <Card className="card-soft lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-[15px]">Your messages</CardTitle>
              <CardDescription>Replies from the team appear below each message.</CardDescription>
            </CardHeader>
            <CardContent>
              {!loadedMine ? (
                <p className="py-6 text-center text-[12.5px] text-muted-foreground">Loading…</p>
              ) : mine.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                  Nothing sent yet — your first message will show up here.
                </p>
              ) : (
                <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
                  {mine.map((row) => (
                    <div key={row.id} className="rounded-xl border border-border/70 p-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={row.category === "bug" ? "destructive" : row.category === "feature" ? "default" : "secondary"}
                          className="text-[10px] capitalize"
                        >
                          {row.category}
                        </Badge>
                        <span className="text-[10.5px] text-muted-foreground">{formatDate(row.created_at)}</span>
                        {row.status === "replied" ? (
                          <Badge variant="success" className="ml-auto gap-1 text-[10px]">
                            <CheckCircle2Icon />
                            Replied
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-4 text-[12.5px] whitespace-pre-wrap">{row.message}</p>
                      {row.admin_reply ? (
                        <div className="mt-2 rounded-lg border border-primary/25 bg-primary/6 px-2.5 py-2">
                          <p className="text-[10px] font-semibold tracking-wider text-primary uppercase">Reply from the team</p>
                          <p className="mt-0.5 text-[12px] whitespace-pre-wrap">{row.admin_reply}</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
