import {
  BarChart3Icon,
  BriefcaseBusinessIcon,
  CandlestickChartIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StarIcon,
  ReceiptTextIcon,
  WalletIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboardIcon;
  description: string;
  /** Matches the route exactly rather than as a prefix. */
  exact?: boolean;
  /**
   * Admin console section this item opens — matched against `?tab=` on
   * `/app/admin` instead of the pathname (every section is one route).
   */
  tab?: AdminTabId;
};

export type NavGroup = { label: string; items: NavItem[] };

/** Which chrome the shell renders: the investor app or the admin console. */
export type ChromeMode = "user" | "admin";

// ---------------------------------------------------------------------------
// Investor navigation
// ---------------------------------------------------------------------------

export const WALLET_HREF = "/app/wallet";

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Menu",
    items: [
      {
        href: "/app",
        label: "Overview",
        icon: LayoutDashboardIcon,
        description: "Portfolio value, performance and your stocks",
        exact: true,
      },
      {
        href: "/app/markets",
        label: "Markets",
        icon: CandlestickChartIcon,
        description: "Browse, search and research every instrument",
      },
      {
        href: "/app/portfolio",
        label: "Portfolio",
        icon: BriefcaseBusinessIcon,
        description: "Holdings, allocation and unrealised returns",
      },
      {
        href: "/app/watchlist",
        label: "Watchlist",
        icon: StarIcon,
        description: "Track instruments you care about",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        href: "/app/activity",
        label: "Activity",
        icon: ReceiptTextIcon,
        description: "Orders, fills and cash movements",
      },
      {
        href: WALLET_HREF,
        label: "Wallet",
        icon: WalletIcon,
        description: "Cash balance, deposits and withdrawals",
      },
      {
        href: "/app/settings",
        label: "Settings",
        icon: SettingsIcon,
        description: "Theme, trading preferences and demo data",
      },
      {
        href: "/app/feedback",
        label: "Support",
        icon: LifeBuoyIcon,
        description: "Report a bug or send feedback",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Admin console navigation
// ---------------------------------------------------------------------------

/** The five sections of `/app/admin`, in the order the tabs are rendered. */
export const ADMIN_TABS = ["overview", "users", "trading", "stocks", "support"] as const;
export type AdminTabId = (typeof ADMIN_TABS)[number];
export const DEFAULT_ADMIN_TAB: AdminTabId = "overview";
export const ADMIN_ROUTE = "/app/admin";

export function adminHref(tab: AdminTabId): string {
  return tab === DEFAULT_ADMIN_TAB ? ADMIN_ROUTE : `${ADMIN_ROUTE}?tab=${tab}`;
}

/** Reads `?tab=` and falls back to the first section for anything unknown. */
export function parseAdminTab(value: string | null | undefined): AdminTabId {
  return ADMIN_TABS.includes(value as AdminTabId) ? (value as AdminTabId) : DEFAULT_ADMIN_TAB;
}

/**
 * Everything an admin account gets. The investor menu is deliberately absent —
 * an admin console is for running Monievest, not for trading it, so there is no
 * wallet, no order ticket and no portfolio here.
 */
export const ADMIN_GROUPS: NavGroup[] = [
  {
    label: "Admin console",
    items: [
      {
        href: adminHref("overview"),
        label: "Overview",
        icon: BarChart3Icon,
        description: "Sign-ups, trade volume, most-traded stocks and open tickets",
        tab: "overview",
      },
      {
        href: adminHref("users"),
        label: "Users",
        icon: ShieldCheckIcon,
        description: "Every account, its balance and its active/disabled status",
        tab: "users",
      },
      {
        href: adminHref("trading"),
        label: "Trading",
        icon: ReceiptTextIcon,
        description: "All orders placed across the platform, with anomaly flags",
        tab: "trading",
      },
      {
        href: adminHref("stocks"),
        label: "Stocks & data",
        icon: CandlestickChartIcon,
        description: "Manage the tradable universe and the price source health",
        tab: "stocks",
      },
      {
        href: adminHref("support"),
        label: "Support inbox",
        icon: LifeBuoyIcon,
        description: "Bug reports and feedback, ready to reply to",
        tab: "support",
      },
    ],
  },
  {
    label: "Admin account",
    items: [
      {
        href: "/app/settings",
        label: "Preferences",
        icon: SettingsIcon,
        description: "Theme, table density and your account details",
      },
    ],
  },
];

/**
 * The menu for the current chrome. Admin accounts get the console sections and
 * nothing else — no wallet, no markets, no portfolio — so this is the single
 * place that decides what an admin can navigate to.
 */
export function navGroupsFor(mode: ChromeMode): NavGroup[] {
  return mode === "admin" ? ADMIN_GROUPS : NAV_GROUPS;
}

/** True when this item is the one the current URL points at. */
export function isNavItemActive(item: NavItem, pathname: string, adminTab: AdminTabId | null): boolean {
  if (item.tab) {
    if (!pathname.startsWith(ADMIN_ROUTE)) return false;
    return adminTab === item.tab;
  }
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
export const APP_GROUPS = NAV_GROUPS;

export const APP_HOME = "/app";
