"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BanIcon, CheckCircle2Icon, SearchIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { AdminCard, EmptyNote, ErrorNote, RefreshButton, TableSkeleton } from "./admin-shared";
import { GeneratedAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAdminUsers, setUserStatus, type AdminPortfolio, type AdminProfile } from "@/lib/admin/data";
import { formatDate, formatMoney } from "@/lib/format";
import { usePortfolio } from "@/lib/store/provider";

export function UsersTab({ supabase }: { supabase: SupabaseClient }) {
  const { auth } = usePortfolio();
  const [profiles, setProfiles] = React.useState<AdminProfile[] | null>(null);
  const [cashByUser, setCashByUser] = React.useState<Map<string, AdminPortfolio>>(new Map());
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [toggling, setToggling] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await fetchAdminUsers(supabase);
      if (!result.ok) throw new Error(result.error);
      setProfiles(result.profiles);
      setCashByUser(new Map(result.portfolios.map((portfolio) => [portfolio.user_id, portfolio])));
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
    if (!profiles) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter((profile) =>
      [profile.display_name, profile.email ?? "", profile.account_number]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [profiles, query]);

  async function toggleStatus(profile: AdminProfile) {
    if (profile.id === auth.userId) {
      toast.error("You cannot disable your own admin account.");
      return;
    }
    const next = profile.status === "active" ? "disabled" : "active";
    setToggling(profile.id);
    const result = await setUserStatus(supabase, profile.id, next);
    setToggling(null);
    if (!result.ok) {
      toast.error(`Could not update ${profile.display_name}`, { description: result.error });
      return;
    }
    setProfiles((current) =>
      current
        ? current.map((row) => (row.id === profile.id ? { ...row, status: next } : row))
        : current,
    );
    toast.success(
      next === "disabled"
        ? `${profile.display_name} is now disabled`
        : `${profile.display_name} is active again`,
      {
        description:
          next === "disabled"
            ? "They will be signed out and blocked from the app."
            : "They can sign in and trade again.",
      },
    );
  }

  return (
    <AdminCard
      title="User management"
      description="Every account, its demo wallet balance and status. Disable spam or abusive accounts — they are signed out immediately."
      actions={<RefreshButton onClick={() => void load()} busy={busy} />}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email or account no…"
            className="pl-9"
          />
        </div>
        <Badge variant="muted" className="tnum">
          {profiles ? `${filtered.length} of ${profiles.length} users` : "…"}
        </Badge>
      </div>

      {error ? <ErrorNote message={error} /> : null}
      {!profiles && !error ? <TableSkeleton /> : null}

      {profiles && filtered.length === 0 && !error ? (
        <EmptyNote>No users match that search.</EmptyNote>
      ) : null}

      {profiles && filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead className="text-right">Wallet balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((profile) => {
                const cash = cashByUser.get(profile.id)?.cash ?? 0;
                const isSelf = profile.id === auth.userId;
                return (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <GeneratedAvatar name={profile.display_name} seed={profile.email ?? profile.id} className="size-8" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-semibold">{profile.display_name}</p>
                            {profile.role === "admin" ? (
                              <Badge className="px-1.5 py-0 text-[9.5px]">Admin</Badge>
                            ) : null}
                            {isSelf ? <Badge variant="muted" className="px-1.5 py-0 text-[9.5px]">You</Badge> : null}
                          </div>
                          <p className="font-mono text-[10.5px] text-muted-foreground">{profile.account_number}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-[12.5px] text-muted-foreground">
                      {profile.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-[12.5px] whitespace-nowrap">
                      {formatDate(profile.created_at)}
                    </TableCell>
                    <TableCell className="tnum text-right font-medium whitespace-nowrap">
                      {formatMoney(cash)}
                    </TableCell>
                    <TableCell>
                      {profile.status === "active" ? (
                        <Badge variant="success">
                          <CheckCircle2Icon />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <BanIcon />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={profile.status === "active" ? "outline" : "default"}
                        className="h-7 text-[11.5px]"
                        disabled={toggling === profile.id || isSelf}
                        onClick={() => void toggleStatus(profile)}
                        title={isSelf ? "You cannot disable yourself" : undefined}
                      >
                        {toggling === profile.id
                          ? "Saving…"
                          : profile.status === "active"
                            ? "Disable"
                            : "Re-enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </AdminCard>
  );
}
