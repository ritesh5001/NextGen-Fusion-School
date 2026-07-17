import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { getAccessToken } from "./lib/session";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Attaches the current access token to every server-fn RPC request.
 * Runs only on the client (server-fn requests originate there).
 */
const attachAuth = createMiddleware().client(async ({ next }) => {
  const token = getAccessToken();
  if (!token) return next();
  return next({
    sendContext: {},
    headers: { Authorization: `Bearer ${token}` },
  });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachAuth],
}));
