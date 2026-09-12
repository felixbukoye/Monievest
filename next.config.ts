import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The dev server is viewed through a proxy on a per-session host
   * (`https://{port}-{sandbox}.e2b.app`). Next.js blocks every `/_next/*` dev
   * resource — JS chunks, CSS and the HMR socket — from origins that are not
   * allowlisted, which leaves the page unhydrated and unstyled (it looks blank
   * even though the HTML rendered fine).
   *
   * The sandbox id changes between sessions, so allow the whole preview domain
   * with wildcards instead of a single host. Dev-only: this has no effect on
   * `next build` / `next start`.
   */
  allowedDevOrigins: ["*.e2b.app", "**.e2b.app"],
};

export default nextConfig;
