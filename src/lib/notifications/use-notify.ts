"use client";

import * as React from "react";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { usePortfolio } from "@/lib/store/provider";
import { pushNotification } from "./store";
import type { NotificationDraft } from "./types";

/**
 * Raises a notification for the current account.
 *
 * Writes to `public.notifications` when a session exists, and to localStorage
 * in the local demo. Fire and forget: a failed insert must never interrupt the
 * action that caused it (a trade still has to fill if the bell is broken).
 */
export function useNotify(): (draft: NotificationDraft) => void {
  const { auth } = usePortfolio();
  const userId = auth.userId;
  const supabase = React.useMemo(() => getSupabaseBrowser(), []);

  return React.useCallback(
    (draft: NotificationDraft) => {
      void pushNotification(supabase, userId, draft);
    },
    [supabase, userId],
  );
}
