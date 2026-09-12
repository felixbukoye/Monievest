"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar"
      className={cn("relative flex size-9 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

/**
 * Monievest has no image assets for users or companies, so avatars are
 * generated from a seed string: initials on a deterministic gradient.
 */
function GeneratedAvatar({
  name,
  seed,
  className,
  textClassName,
}: {
  name: string;
  seed?: string;
  className?: string;
  textClassName?: string;
}) {
  const key = seed ?? name;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const hue = hash % 360;

  return (
    <Avatar
      className={cn("border border-white/10 shadow-sm", className)}
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 72% 56%), hsl(${(hue + 48) % 360} 68% 42%))`,
      }}
      aria-label={name}
    >
      <span className={cn("flex size-full items-center justify-center text-[13px] font-semibold text-white", textClassName)}>
        {initials(name)}
      </span>
    </Avatar>
  );
}

export { Avatar, GeneratedAvatar };
