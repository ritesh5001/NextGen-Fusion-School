import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Convenience alias so an admin can reach the sign-in page from any device by
 * typing `/login` directly, without needing to find the Login button on the
 * public school website. Redirects to the real login route, preserving any
 * `?redirect=` / `?as=` query params.
 */
export const Route = createFileRoute("/login")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/auth/login", search: search as never });
  },
});
