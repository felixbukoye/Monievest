"use client";

import {
  BarChart3Icon,
  CandlestickChartIcon,
  LifeBuoyIcon,
  ReceiptTextIcon,
  UsersIcon,
} from "lucide-react";
import * as React from "react";

import { OverviewTab } from "@/components/admin/overview-tab";
import { StocksTab } from "@/components/admin/stocks-tab";
import { SupportTab } from "@/components/admin/support-tab";
import { TradingTab } from "@/components/admin/trading-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { AdminPageHeader } from "@/components/admin/admin-shared";
import { adminHref, parseAdminTab, type AdminTabId } from "@/components/app/nav";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setActiveAdminTab, useActiveAdminTab } from "@/lib/hooks/use-admin-tab";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3Icon },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "trading", label: "Trading", icon: ReceiptTextIcon },
  { id: "stocks", label: "Stocks & data", icon: CandlestickChartIcon },
  { id: "support", label: "Support", icon: LifeBuoyIcon },
] as const satisfies readonly { id: AdminTabId; label: string; icon: typeof BarChart3Icon }[];

/**
 * The admin dashboard. Only reachable with `profiles.role = 'admin'` —
 * the route guard (`requireAdminProfile`) bounces everyone else, and every
 * query below is additionally locked down by the admin RLS policies.
 *
 * The open section lives in `?tab=` (and in the shared admin-tab store the
 * sidebar reads), so the admin menu, deep links from the notification bell and
 * a page refresh all agree on what is on screen.
 */
export function AdminView({ adminName }: { adminName: string }) {
  const supabase = React.useMemo(() => getSupabaseBrowser(), []);
  const activeTab = useActiveAdminTab();

  React.useEffect(() => {
    const readFromUrl = () =>
      setActiveAdminTab(parseAdminTab(new URLSearchParams(window.location.search).get("tab")));
    readFromUrl();
    window.addEventListener("popstate", readFromUrl);
    return () => window.removeEventListener("popstate", readFromUrl);
  }, []);

  const changeTab = React.useCallback((value: string) => {
    const next = parseAdminTab(value);
    setActiveAdminTab(next);
    // replaceState keeps the URL shareable without pushing a history entry for
    // every tab click.
    window.history.replaceState(null, "", adminHref(next));
  }, []);

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

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1 p-1">
          {TABS.map((tab) => (
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
    </div>
  );
}

