"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const current = resolvedTheme ?? theme;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Change colour theme"
        >
          {mounted ? (
            current === "dark" ? (
              <MoonIcon className="size-[18px]" />
            ) : current === "light" ? (
              <SunIcon className="size-[18px]" />
            ) : (
              <MonitorIcon className="size-[18px]" />
            )
          ) : (
            <span className="size-[18px] rounded-full border border-current opacity-40" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={compact ? "min-w-[9rem]" : "min-w-[11rem]"}>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <SunIcon />
          Light
          {current === "light" && <span className="ml-auto text-[11px] text-primary">Active</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <MoonIcon />
          Dark
          {current === "dark" && <span className="ml-auto text-[11px] text-primary">Active</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <MonitorIcon />
          System
          {theme === "system" && <span className="ml-auto text-[11px] text-primary">Active</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
