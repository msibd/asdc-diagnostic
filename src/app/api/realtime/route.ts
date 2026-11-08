import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { subscribeToClinicChanges } from "@/lib/clinic-realtime";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "dashboard:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let unsubscribe: (() => void) | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    request.signal.removeEventListener("abort", close);
    unsubscribe?.();
  };
  const send = (event: string, data = "{}") => {
    if (closed || !controller) return;
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
    } catch {
      close();
    }
  };
  const reconnect = () => {
    send("reconnect");
    close();
    try {
      controller?.close();
    } catch {
      // The client may have disconnected already.
    }
  };
  try {
    unsubscribe = await subscribeToClinicChanges((change) => {
      if (change.operation === "RECONNECT") reconnect();
      else send("clinic-change", JSON.stringify(change));
    });
  } catch (error) {
    logger.error("Unable to subscribe to clinic realtime updates.", { error });
    return NextResponse.json({ error: "Realtime updates are temporarily unavailable." }, { status: 503 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      request.signal.addEventListener("abort", close, { once: true });
      send("ready");
      heartbeat = setInterval(() => send("heartbeat"), 25_000);
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
