// AwajDigital voice gateway adapter: the only code that talks to the voice provider.
// API reference: https://awajdigital.com/api-docs (bearer token, JSON, HTTPS only).

const BASE_URL = "https://api.awajdigital.com/api";
const TIMEOUT_MS = 15_000;

export type VoiceCredentials = { token: string; sender: string };
export type VoiceResult = { ok: true; detail: string; broadcastId?: string } | { ok: false; code: string; message: string };

// HTTP statuses the provider documents, in words the clinic can act on.
const STATUS_MESSAGES: Record<number, string> = {
  400: "The provider rejected the request (duplicate numbers or a voice that does not fit).",
  401: "The API token is not valid.",
  402: "The AwajDigital balance is too low. Recharge the account.",
  403: "The voice or sender number is not approved or not active on this account.",
  409: "This request was already sent in the last 15 minutes.",
  422: "The provider could not accept the phone numbers or settings.",
  429: "Too many requests to the provider. Wait a moment and try again.",
};
export const describeVoiceStatus = (status: number) =>
  STATUS_MESSAGES[status] ?? (status >= 500 ? "AwajDigital had an internal error. Try again later." : `The voice provider refused the request (HTTP ${status}).`);

type Answer = { status: number; body: Record<string, unknown> };

async function call(path: string, token: string, init: RequestInit, fetchImpl: typeof fetch): Promise<Answer> {
  const response = await fetchImpl(`${BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  try {
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  } catch {
    // Never pass the raw body on: it is not ours to show.
    return { status: response.status, body: {} };
  }
}

const failure = (answer: Answer): VoiceResult => ({ ok: false, code: String(answer.status), message: describeVoiceStatus(answer.status) });

function networkFailure(error: unknown): VoiceResult {
  const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  return { ok: false, code: timedOut ? "TIMEOUT" : "NETWORK", message: timedOut ? "The voice provider did not answer in time." : "The voice provider could not be reached." };
}

/** "8801712345678" -> "01712345678": the form AwajDigital wants for recipients. */
export const toLocalNumber = (msisdn: string) => (msisdn.startsWith("880") ? msisdn.slice(2) : msisdn);

/**
 * Checks the token, the sender number and the voice without placing a call: reads the balance, the
 * sender list and the voice list. Costs nothing.
 */
export async function checkVoiceSetup(credentials: VoiceCredentials, voice: string, fetchImpl: typeof fetch = fetch): Promise<VoiceResult> {
  try {
    const balance = await call("/balance", credentials.token, { method: "GET" }, fetchImpl);
    if (balance.status !== 200 || balance.body.success !== true) return failure(balance);

    const senders = await call("/senders", credentials.token, { method: "GET" }, fetchImpl);
    if (senders.status !== 200) return failure(senders);
    // The provider shows numbers with or without the 880 prefix, so compare the last 10 digits.
    const tail = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(-10);
    const sender = (senders.body.senders as { callingNumber?: string; status?: string }[] | undefined)
      ?.find((row) => tail(row.callingNumber) === tail(credentials.sender));
    if (!sender) return { ok: false, code: "SENDER", message: "This sender number is not on the AwajDigital account." };
    if (sender.status !== "active") return { ok: false, code: "SENDER", message: "This sender number is not active on the AwajDigital account." };

    const voices = await call("/voices", credentials.token, { method: "GET" }, fetchImpl);
    if (voices.status !== 200) return failure(voices);
    const found = (voices.body.voices as { name?: string; status?: string }[] | undefined)
      ?.find((row) => row.name?.toLowerCase() === voice.toLowerCase());
    if (!found) return { ok: false, code: "VOICE", message: `No voice named "${voice}" on the AwajDigital account. Upload it in the AwajDigital panel first.` };
    if (found.status !== "approved") return { ok: false, code: "VOICE", message: `The voice "${voice}" is ${found.status ?? "not approved"} at AwajDigital. Wait for approval.` };

    const amount = Number(balance.body.balance);
    return { ok: true, detail: Number.isFinite(amount) ? `Connected. Balance: ${amount.toFixed(2)} BDT. Voice approved, sender active.` : "Connected. Voice approved, sender active." };
  } catch (error) {
    return networkFailure(error);
  }
}

/**
 * Plays one approved voice to up to 999 numbers (01XXXXXXXXX, no duplicates). "ok" means the provider
 * accepted the broadcast; each call is then placed by the provider.
 */
export async function sendBroadcast(credentials: VoiceCredentials, voice: string, phoneNumbers: string[], requestId: string, fetchImpl: typeof fetch = fetch): Promise<VoiceResult> {
  if (!phoneNumbers.length || phoneNumbers.length > 999) return { ok: false, code: "SIZE", message: "A broadcast needs between 1 and 999 numbers." };
  try {
    const answer = await call("/broadcasts", credentials.token, {
      method: "POST",
      body: JSON.stringify({ request_id: requestId, voice, sender: credentials.sender, phone_numbers: phoneNumbers }),
    }, fetchImpl);
    const broadcast = answer.body.broadcast as { id?: unknown } | undefined;
    if (answer.status >= 200 && answer.status < 300 && answer.body.success === true) {
      return { ok: true, detail: "Accepted by AwajDigital.", broadcastId: broadcast?.id == null ? undefined : String(broadcast.id) };
    }
    return failure(answer);
  } catch (error) {
    return networkFailure(error);
  }
}
