import type { Metadata } from "next";

import { ActivityView } from "@/components/views/activity-view";

export const metadata: Metadata = {
  title: "Activity",
  description: "Every order, fill, deposit, withdrawal and dividend on your Monievest account, with filters and export.",
};

export default function ActivityPage() {
  return <ActivityView />;
}
