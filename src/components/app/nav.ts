import {
  BriefcaseBusinessIcon,
  CandlestickChartIcon,
  LayoutDashboardIcon,
  SettingsIcon,
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
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
export const APP_GROUPS = NAV_GROUPS;

export const APP_HOME = "/app";
