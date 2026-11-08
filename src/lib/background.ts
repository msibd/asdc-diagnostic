import { after } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Runs work after the response has been sent (an SMS, for example), so the person is not kept
 * waiting and a slow or failing provider never affects the request. Outside a Next.js request
 * (scripts, tests) it simply starts the work. Errors are logged, never thrown.
 */
export function runAfterResponse(task: () => Promise<unknown>) {
  const guarded = () => task().catch((error: unknown) => logger.error("Background task failed.", { error }));
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
