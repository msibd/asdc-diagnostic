import type { Instrumentation } from "next";

// Every error Next.js catches on the server (pages, route handlers, server actions) passes through
// here once, so it is logged in the same structured format as the rest of the app. This is also the
// single place to add an error-monitoring service later.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logger } = await import("@/lib/logger");
  logger.error("Unhandled server error", {
    error: error instanceof Error ? error : { message: String(error) },
    // The path only: query strings can carry personal data.
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
