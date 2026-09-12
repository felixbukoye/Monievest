"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      closeButton
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 18px 45px -20px rgba(0,0,0,0.55)",
          fontSize: "13.5px",
        },
        classNames: {
          success: "[&_[data-icon]]:text-gain",
          error: "[&_[data-icon]]:text-loss",
          info: "[&_[data-icon]]:text-primary",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          closeButton: "bg-card border-border text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
