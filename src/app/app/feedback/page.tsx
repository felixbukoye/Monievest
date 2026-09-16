import type { Metadata } from "next";

import { FeedbackView } from "@/components/views/feedback-view";

export const metadata: Metadata = {
  title: "Support",
  description: "Report a bug or send feedback about Monievest.",
};

export default function FeedbackPage() {
  return <FeedbackView />;
}
