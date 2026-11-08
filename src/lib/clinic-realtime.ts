import { Client } from "pg";
import { logger } from "@/lib/logger";

type ClinicChange = {
  table?: string;
  operation?: string;
};

type Subscriber = (change: ClinicChange) => void;

type ListenerState = {
  client: Client | null;
  connection: Promise<void> | null;
  subscribers: Set<Subscriber>;
  shutdownTimer: ReturnType<typeof setTimeout> | null;
};

type RealtimeGlobal = typeof globalThis & {
  clinicRealtimeListener?: ListenerState;
};

const globalForRealtime = globalThis as RealtimeGlobal;
const listenerState = globalForRealtime.clinicRealtimeListener ??= {
  client: null,
  connection: null,
  subscribers: new Set<Subscriber>(),
  shutdownTimer: null,
};

async function ensureListener() {
  if (listenerState.client) return;
  if (listenerState.connection) return listenerState.connection;

  // LISTEN needs a session connection; a transaction pooler (DATABASE_URL on Supabase) drops it.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; clinic realtime updates cannot connect.");
  }

  const client = new Client({ connectionString });
  listenerState.connection = (async () => {
    try {
      await client.connect();
      await client.query("LISTEN clinic_changes");
      client.on("notification", (message) => {
        if (message.channel !== "clinic_changes" || !message.payload) return;
        let change: ClinicChange;
        try {
          change = JSON.parse(message.payload) as ClinicChange;
        } catch (error) {
          logger.warn("Ignoring malformed clinic realtime notification.", { error });
          return;
        }
        for (const subscriber of listenerState.subscribers) subscriber(change);
      });
      client.on("error", (error: Error) => {
        logger.error("Clinic PostgreSQL realtime listener failed.", { error });
        if (listenerState.client === client) listenerState.client = null;
        for (const subscriber of listenerState.subscribers) subscriber({ operation: "RECONNECT" });
        void client.end().catch((closeError: unknown) => {
          logger.warn("Unable to close failed clinic PostgreSQL listener.", { error: closeError });
        });
      });
      listenerState.client = client;
    } catch (error) {
      try {
        await client.end();
      } catch (closeError) {
        logger.warn("Unable to clean up failed clinic PostgreSQL listener.", { error: closeError });
      }
      throw error;
    } finally {
      listenerState.connection = null;
    }
  })();

  return listenerState.connection;
}

export async function subscribeToClinicChanges(subscriber: Subscriber) {
  if (listenerState.shutdownTimer) {
    clearTimeout(listenerState.shutdownTimer);
    listenerState.shutdownTimer = null;
  }
  listenerState.subscribers.add(subscriber);

  try {
    await ensureListener();
  } catch (error) {
    listenerState.subscribers.delete(subscriber);
    throw error;
  }

  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    listenerState.subscribers.delete(subscriber);
    if (listenerState.subscribers.size || listenerState.shutdownTimer) return;

    listenerState.shutdownTimer = setTimeout(() => {
      listenerState.shutdownTimer = null;
      if (listenerState.subscribers.size) return;
      const client = listenerState.client;
      listenerState.client = null;
      if (client) {
        void client.end().catch((error: unknown) => {
          logger.warn("Unable to close idle clinic PostgreSQL listener.", { error });
        });
      }
    }, 15_000);
  };
}
