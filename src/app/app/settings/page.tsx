import type { Metadata } from "next";

import { SettingsView } from "@/components/views/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Theme, trading preferences, profile and demo data controls for Monievest.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
