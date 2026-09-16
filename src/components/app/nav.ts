import {
  BarChart3Icon,
  BriefcaseBusinessIcon,
  CandlestickChartIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  ReceiptTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StarIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboardIcon;
  description: string;
  /** Matches the route exactly rather than as a prefix. */
  exact?: boolean;
  /** Admin sections share one route; this is the `?tab=` they stand for. */
  tab?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

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
        href: "/app/wallet",
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

/** Shown only to accounts with `profiles.role = 'admin'`. */
export const ADMIN_GROUP: NavGroup = {
  label: "Administration",
  items: [
    {
      href: "/app/admin",
      label: "Admin dashboard",
      icon: ShieldCheckIcon,
      description: "Users, trades, stocks, analytics and support",
      exact: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

export const ADMIN_ROUTE = "/app/admin";

/**
 * The five sections of the admin dashboard. They all live on one route
 * (`/app/admin`) and are picked with `?tab=`, so the sidebar can deep-link
 * into a section exactly like any other page.
 */
export const ADMIN_TABS = [
  { id: "overview", label: "Overview", icon: BarChart3Icon },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "trading", label: "Trading", icon: ReceiptTextIcon },
  { id: "stocks", label: "Stocks & data", icon: CandlestickChartIcon },
  { id: "support", label: "Support", icon: LifeBuoyIcon },
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

export function isAdminTabId(value: string | null | undefined): value is AdminTabId {
  return ADMIN_TABS.some((tab) => tab.id === value);
}

export function adminHref(tab: AdminTabId = "overview"): string {
  return tab === "overview" ? ADMIN_ROUTE : `${ADMIN_ROUTE}?tab=${tab}`;
}

/**
 * Menu shown while you are inside the admin dashboard: the admin sections and
 * a way back out. The investing side of the app (wallet, trading, portfolio)
 * is deliberately absent — the admin dashboard is admin-only.
 */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Administration",
    items: [
      {
        href: adminHref("overview"),
        label: "Overview",
        icon: BarChart3Icon,
        description: "Signups, activity and platform totals",
        tab: "overview",
      },
      {
        href: adminHref("users"),
        label: "Users",
        icon: UsersIcon,
        description: "Accounts, roles and access",
        tab: "users",
      },
      {
        href: adminHref("trading"),
        label: "Trading",
        icon: ReceiptTextIcon,
        description: "Every order placed on the platform",
        tab: "trading",
      },
      {
        href: adminHref("stocks"),
        label: "Stocks & data",
        icon: CandlestickChartIcon,
        description: "Demo stock universe and prices",
        tab: "stocks",
      },
      {
        href: adminHref("support"),
        label: "Support",
        icon: LifeBuoyIcon,
        description: "Bug reports, feedback and replies",
        tab: "support",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        href: "/app",
        label: "Back to dashboard",
        icon: LayoutDashboardIcon,
        description: "Leave admin and open your own portfolio",
        exact: true,
      },
      {
        href: "/app/settings",
        label: "Settings",
        icon: SettingsIcon,
        description: "Theme, trading preferences and demo data",
      },
    ],
  },
];

/** True while the user is somewhere under `/app/admin`. */
export function isAdminPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === ADMIN_ROUTE || pathname.startsWith(`${ADMIN_ROUTE}/`);
}

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
export const APP_GROUPS = NAV_GROUPS;

export const APP_HOME = "/app";
