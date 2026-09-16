import type { Metadata } from "next";

import { AdminView } from "@/components/views/admin-view";
import { requireAdminProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin dashboard",
  description:
    "Monievest administration — user management, demo trading activity, stock universe, analytics and support inbox.",
  robots: { index: false },
};

/**
 * The admin dashboard. `requireAdminProfile()` redirects:
 *   • unconfigured / signed-out visitors → sign-in,
 *   • signed-in non-admins               → their normal dashboard.
 */
export default async function AdminPage() {
  const profile = await requireAdminProfile();
  return <AdminView adminName={profile.display_name} />;
}
