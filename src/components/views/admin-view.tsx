"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { OverviewTab } from "@/components/admin/overview-tab";
import { StocksTab } from "@/components/admin/stocks-tab";
import { SupportTab } from "@/components/admin/support-tab";
import { TradingTab } from "@/components/admin/trading-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { AdminPageHeader, TableSkeleton } from "@/components/admin/admin-shared";
import { ADMIN_TABS, adminHref, isAdminTabId } from "@/components/app/nav";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * The five sections live on one route and are selected with `?tab=`, which is
 * what lets the sidebar, the hamburger menu and the notification bell deep-link
 * straight to (say) an open support ticket.
 */
function AdminSections({ supabase }: { supabase: SupabaseClient }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab");
  const active = isAdminTabId(requested) ? requested : "overview";

  return (
    <Tabs
      value={active}
      onValueChange={(next) =>
        router.replace(adminHref(isAdminTabId(next) ? next : "overview"), { scroll: false })
      }
    >
      <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1 p-1">
        {ADMIN_TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
            <tab.icon className="size-3.5" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab supabase={supabase} />
      </TabsContent>
      <TabsContent value="users">
        <UsersTab supabase={supabase} />
      </TabsContent>
      <TabsContent value="trading">
        <TradingTab supabase={supabase} />
      </TabsContent>
      <TabsContent value="stocks">
        <StocksTab supabase={supabase} />
      </TabsContent>
      <TabsContent value="support">
        <SupportTab supabase={supabase} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * The admin dashboard. Only reachable with `profiles.role = 'admin'` —
 * the route guard (`requireAdminProfile`) bounces everyone else, and every
 * query below is additionally locked down by the admin RLS policies.
 */
export function AdminView({ adminName }: { adminName: string }) {
  const supabase = React.useMemo(() => getSupabaseBrowser(), []);

  if (!supabase) {
    return (
      <Card className="card-soft">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold">Supabase is not configured</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The admin dashboard reads live account data from your Supabase project. Add{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your env file to enable it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Admin dashboard"
        description={`Signed in as ${adminName}. Ordinary users never see this — they land on their personal dashboard instead.`}
      />

      {/* Reads ?tab=, so it needs a boundary of its own. */}
      <React.Suspense fallback={<TableSkeleton rows={8} />}>
        <AdminSections supabase={supabase} />
      </React.Suspense>
    </div>
  );
}
