// BulkSMSBD gateway adapter: the only code that talks to the SMS provider.
//
// Always HTTPS (the provider's own examples use http://, which would send the API key in clear
// text). The key travels in the POST body, never in a URL, except for the balance check, which the
// provider only offers as GET; that request is also HTTPS-only.

const BASE_URL = "https://bulksmsbd.net/api";
const TIMEOUT_MS = 10_000;
const SUCCESS = 202;

export type SmsCredentials = { apiKey: string; senderId: string };
export type GatewayResult = { ok: true; code: string; detail: string } | { ok: false; code: string; message: string };

// The provider's documented error codes, in words the clinic can act on.
const CODE_MESSAGES: Record<number, string> = {
  1001: "The phone number is not valid.",
  1002: "The sender ID is not correct or is disabled.",
  1003: "A required field is missing.",
  1005: "The SMS provider had an internal error. Try again later.",
  1006: "The account balance has expired.",
  1007: "The SMS balance is too low. Recharge the BulkSMSBD account.",
  1011: "The API key is not valid.",
  1012: "Masking SMS must be sent in Bangla.",
  1013: "The sender ID is not linked to this API key.",
  1014: "The sender type was not found.",
  1015: "The sender ID has no valid gateway.",
  1018: "The BulkSMSBD account is disabled.",
  1031: "The BulkSMSBD account is not verified.",
  1032: "This server's IP address is not whitelisted in the BulkSMSBD panel.",
};

export const describeGatewayCode = (code: number) => CODE_MESSAGES[code] ?? `The SMS provider refused the request (code ${code}).`;

async function call(path: string, init: RequestInit, fetchImpl: typeof fetch): Promise<{ response_code?: number; [key: string]: unknown }> {
  const response = await fetchImpl(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  const text = await response.text();
  try {
    return JSON.parse(text) as { response_code?: number };
  } catch {
    // Never pass the raw body on: it is not ours to show.
    return { response_code: response.ok ? -1 : -response.status };
  }
}

function networkFailure(error: unknown): GatewayResult {
  const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  return {
    ok: false,
    code: timedOut ? "TIMEOUT" : "NETWORK",
    message: timedOut ? "The SMS provider did not answer in time." : "The SMS provider could not be reached.",
  };
}

/** Sends one message. "ok" means the provider accepted it for delivery (code 202). */
export async function sendSms(credentials: SmsCredentials, msisdn: string, message: string, fetchImpl: typeof fetch = fetch): Promise<GatewayResult> {
  try {
    const body = new URLSearchParams({ api_key: credentials.apiKey, senderid: credentials.senderId, number: msisdn, message });
    const result = await call("/smsapi", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    }, fetchImpl);
    const code = Number(result.response_code);
    if (code === SUCCESS) return { ok: true, code: String(code), detail: "Accepted by the SMS provider." };
    return { ok: false, code: String(code), message: code > 0 ? describeGatewayCode(code) : "The SMS provider sent an unreadable answer." };
  } catch (error) {
    return networkFailure(error);
  }
}

/** Checks the key by reading the account balance. Sends nothing and costs nothing. */
export async function checkBalance(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<GatewayResult> {
  try {
    const result = await call(`/getBalanceApi?api_key=${encodeURIComponent(apiKey)}`, { method: "GET", headers: { Accept: "application/json" } }, fetchImpl);
    const code = Number(result.response_code);
    if (code === SUCCESS) {
      const balance = Number(result.balance);
      return { ok: true, code: String(code), detail: Number.isFinite(balance) ? `Connected. Balance: ${balance.toFixed(2)} BDT.` : "Connected." };
    }
    return { ok: false, code: String(code), message: code > 0 ? describeGatewayCode(code) : "The SMS provider sent an unreadable answer." };
  } catch (error) {
    return networkFailure(error);
  }
}
