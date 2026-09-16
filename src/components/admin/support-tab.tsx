"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BugIcon, CheckIcon, LightbulbIcon, MessageSquareIcon, ReplyIcon, Trash2Icon, XIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { AdminCard, EmptyNote, ErrorNote, RefreshButton, TableSkeleton } from "./admin-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchAdminUsers, fetchFeedback, replyToFeedback, setFeedbackStatus, type AdminProfile, type FeedbackRow } from "@/lib/admin/data";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<FeedbackRow["category"], { label: string; icon: typeof BugIcon }> = {
  bug: { label: "Bug report", icon: BugIcon },
  feedback: { label: "Feedback", icon: MessageSquareIcon },
  feature: { label: "Feature idea", icon: LightbulbIcon },
};

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "replied", label: "Replied" },
  { id: "closed", label: "Closed" },
] as const;

export function SupportTab({ supabase }: { supabase: SupabaseClient }) {
  const [feedback, setFeedback] = React.useState<FeedbackRow[] | null>(null);
  const [profiles, setProfiles] = React.useState<Map<string, AdminProfile>>(new Map());
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const [replyTarget, setReplyTarget] = React.useState<FeedbackRow | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [feedbackResult, usersResult] = await Promise.all([fetchFeedback(supabase), fetchAdminUsers(supabase)]);
      if (!feedbackResult.ok) throw new Error(feedbackResult.error);
      setFeedback(feedbackResult.feedback);
      if (usersResult.ok) setProfiles(new Map(usersResult.profiles.map((profile) => [profile.id, profile])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    // Deferred so the effect itself never calls setState synchronously.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = React.useMemo(() => {
    if (!feedback) return [];
    return feedback.filter((row) => (statusFilter === "all" ? true : row.status === statusFilter));
  }, [feedback, statusFilter]);

  const openCount = feedback?.filter((row) => row.status === "open").length ?? 0;

  function patchLocal(id: string, patch: Partial<FeedbackRow>) {
    setFeedback((current) => (current ? current.map((row) => (row.id === id ? { ...row, ...patch } : row)) : current));
  }

  async function submitReply() {
    if (!replyTarget) return;
    const text = replyText.trim();
    if (!text) {
      toast.error("Write a reply first.");
      return;
    }
    setSaving(true);
    const result = await replyToFeedback(supabase, replyTarget.id, text);
    setSaving(false);
    if (!result.ok) {
      toast.error("Reply not saved", { description: result.error });
      return;
    }
    patchLocal(replyTarget.id, { admin_reply: text, status: "replied", replied_at: new Date().toISOString() });
    toast.success(`Reply saved for ${replyTarget.email ?? "the user"}`);
    setReplyTarget(null);
    setReplyText("");
  }

  async function toggleClosed(row: FeedbackRow) {
    const next = row.status === "closed" ? "open" : "closed";
    const result = await setFeedbackStatus(supabase, row.id, next);
    if (!result.ok) {
      toast.error("Could not update status", { description: result.error });
      return;
    }
    patchLocal(row.id, { status: next });
  }

  async function remove(row: FeedbackRow) {
    const { error: deleteError } = await supabase.from("feedback").delete().eq("id", row.id);
    if (deleteError) {
      toast.error("Could not delete", { description: deleteError.message });
      return;
    }
    setFeedback((current) => (current ? current.filter((item) => item.id !== row.id) : current));
    toast.success("Feedback deleted");
  }

  return (
    <>
      <AdminCard
        title="Support inbox"
        description="Bug reports and feedback submitted from the Support page. Reply and the user sees it on their Support page."
        actions={
          <div className="flex items-center gap-2">
            {openCount > 0 ? <Badge variant="warning">{openCount} open</Badge> : null}
            <RefreshButton onClick={() => void load()} busy={busy} />
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                statusFilter === filter.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {error ? <ErrorNote message={error} /> : null}
        {!feedback && !error ? <TableSkeleton /> : null}
        {feedback && filtered.length === 0 && !error ? (
          <EmptyNote>Nothing here — no {statusFilter === "all" ? "feedback" : `${statusFilter} feedback`} yet.</EmptyNote>
        ) : null}

        {feedback && filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((row) => {
              const meta = CATEGORY_META[row.category];
              const profile = profiles.get(row.user_id);
              return (
                <div key={row.id} className="rounded-xl border border-border/70 bg-background/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.category === "bug" ? "destructive" : row.category === "feature" ? "default" : "secondary"} className="gap-1">
                      <meta.icon />
                      {meta.label}
                    </Badge>
                    <Badge
                      variant={row.status === "open" ? "warning" : row.status === "replied" ? "success" : "muted"}
                      className="capitalize"
                    >
                      {row.status}
                    </Badge>
                    <span className="text-[12px] font-medium">
                      {profile?.display_name ?? "Unknown user"}
                      <span className="text-muted-foreground"> · {row.email ?? "no email"}</span>
                    </span>
                    <span className="ml-auto text-[11.5px] text-muted-foreground" title={formatDateTime(row.created_at)}>
                      {relativeTime(row.created_at)}
                    </span>
                  </div>

                  <p className="mt-2.5 text-[13px] whitespace-pre-wrap">{row.message}</p>

                  {row.admin_reply ? (
                    <div className="mt-3 rounded-lg border border-primary/25 bg-primary/6 px-3 py-2.5">
                      <p className="text-[10.5px] font-semibold tracking-wider text-primary uppercase">
                        Your reply {row.replied_at ? `· ${relativeTime(row.replied_at)}` : ""}
                      </p>
                      <p className="mt-1 text-[12.5px] whitespace-pre-wrap">{row.admin_reply}</p>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={row.admin_reply ? "outline" : "default"}
                      className="h-7 gap-1.5 text-[11.5px]"
                      onClick={() => {
                        setReplyTarget(row);
                        setReplyText(row.admin_reply ?? "");
                      }}
                    >
                      <ReplyIcon />
                      {row.admin_reply ? "Edit reply" : "Reply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-[11.5px]"
                      onClick={() => void toggleClosed(row)}
                    >
                      {row.status === "closed" ? <XIcon /> : <CheckIcon />}
                      {row.status === "closed" ? "Reopen" : "Close"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-[11.5px] text-loss hover:text-loss"
                      onClick={() => void remove(row)}
                    >
                      <Trash2Icon />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </AdminCard>

      <Dialog open={replyTarget !== null} onOpenChange={(open) => !open && setReplyTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {replyTarget?.email ?? "user"}</DialogTitle>
            <DialogDescription>
              They will see this reply on their Support page. Original message:
              <span className="mt-1.5 block rounded-lg bg-muted px-3 py-2 text-[12px] italic">
                “{replyTarget?.message}”
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-reply">Your reply</Label>
            <Textarea
              id="admin-reply"
              rows={4}
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Thanks for flagging this — here's what's happening…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitReply()} disabled={saving}>
              {saving ? "Saving…" : "Save reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
