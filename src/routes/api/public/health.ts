import { createFileRoute } from "@tanstack/react-router";

// Public health check endpoint.
// Purpose:
//  - Uptime monitoring (UptimeRobot, cron-job.org, BetterStack, etc.)
//  - Keeps free-tier hosts (Render free) warm by receiving periodic pings
//  - Simple liveness probe for load balancers
//
// Recommended: configure an external cron to GET this URL every 5-10 minutes.
// Example services (all have free tiers):
//   - https://cron-job.org
//   - https://uptimerobot.com
//   - https://betterstack.com

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            status: "ok",
            service: "NextGen Fusion School",
            timestamp: new Date().toISOString(),
            uptime_seconds: Math.floor(process.uptime?.() ?? 0),
          },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate",
            },
          },
        );
      },
      HEAD: async () => {
        return new Response(null, { status: 200 });
      },
    },
  },
});
