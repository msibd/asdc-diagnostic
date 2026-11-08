# Promotional voice campaigns (AwajDigital): design

Status: draft for review. Nothing is implemented yet.

## Goal
Staff send voice calls to patients for promotional offers and occasions (Eid, health camps, and so on) from the admin panel.
Voices and campaigns are each kept in groups so the right voice and audience can be reused for each kind of occasion.
Today AwajDigital is used only for appointment reminders (`src/modules/voice`).

## Decisions made with the owner
- Groups are categories: a group holds many voices or many campaigns. They are not patient groups.
- Approach A: two-level tables (`VoiceGroup -> Voice`, `CampaignGroup -> Campaign`).
- Audience is chosen by filter, recomputed on every send.
- Consent is an opt-out flag on the patient (default: patients are called unless marked).
- Included features: Direct TTS voices, per-number results, balance and cost estimate, voice upload.
- Out of scope for v1: scheduling, dynamic (per-name) broadcasts, IVR surveys, call center, auto dialer, recharge from this site.
- The existing reminder feature and `VoiceConfiguration` stay unchanged. Token, sender and the connection test are reused.

## Data model (Prisma, one migration)
- `VoiceGroup`: id, name (unique), sortOrder, timestamps.
- `Voice`: id, groupId, name, kind (`PRERECORDED` | `TTS`), providerVoiceName (prerecorded), ttsText (TTS), isActive, timestamps.
- `CampaignGroup`: id, name (unique), sortOrder, timestamps.
- `Campaign`: id, groupId, name, voiceId, filter (Json), isActive, timestamps.
- `CampaignRun`: id, campaignId, status, totalNumbers, skippedCount, estimatedCost, providerBroadcastIds (text[]), actorId, createdAt.
- `CampaignRecipient`: id, runId, maskedPhone, phoneHash, status, providerCode, createdAt. The full number is never stored, matching `SmsLog`.
- `Patient.promoOptOut Boolean @default(false)`, editable on the patient form.
- Deleting a group is blocked while it has items. A voice used by a campaign cannot be deleted, only deactivated.

## Audience filter (v1)
Zod-validated JSON: `{ lastVisit?: { notWithinDays: number }, serviceIds?: string[], doctorIds?: string[] }`.
Always applied: `isActive`, valid mobile via `normalizeBdMobile`, `promoOptOut = false`.
One call per number even when patients share a number. Numbers called by any campaign in the last 20 hours are skipped.

## Send flow
1. Staff open a campaign and press Preview. No provider call is made except the balance read.
2. Preview shows: matched numbers, excluded (opt-out, invalid, recently called), estimated cost (numbers x pulses x pulse rate) and balance.
   Sending is blocked when the balance is lower than the estimate.
3. Staff confirm. The service splits numbers into batches of at most 999 and calls `POST /broadcasts` for each batch with a fresh `request_id`.
   TTS voices use the Direct TTS endpoint instead (fields to be confirmed, see below).
4. A `CampaignRun` and its `CampaignRecipient` rows are written. Sending is refused unless voice is enabled and the last connection test succeeded, as for reminders.
5. A run's results page reads per-number outcomes from the provider (Get Broadcast Result) and updates recipient status.
6. Rate limit: `hitRateLimit` per user, as in `/api/voice/reminders`. Errors use the existing provider status messages.

## Code layout
- `src/modules/voice/awajdigital.ts`: add the TTS, upload-voice, list-broadcasts and broadcast-result calls. It stays the only file that talks to the provider.
- `src/modules/voice/campaign-service.ts`: groups, voices and campaigns CRUD, audience query, preview, send, results.
- `src/app/api/voice/{voice-groups,voices,campaign-groups,campaigns}/...` and `.../campaigns/[id]/{preview,send,runs}` routes. Admin session and permission checks follow the reminders route.
- UI: a new "Campaigns" panel next to the voice settings in the `sms` section: Voices tab, Campaigns tab, Run results. Balance shows in the panel header.

## Errors and safety
- The provider token is never returned to the browser. Responses never include raw provider bodies.
- Provider failures map to the existing messages (balance too low, voice not approved, duplicate request, and so on).
- Every send, group change and campaign change writes an `SmsLog` entry (`VOICE_PROMO`, `VOICE_CAMPAIGN_UPDATED`).

## Testing
Vitest like `tests/voice.test.ts`: audience filter and exclusions, batching at 999, cost estimate and balance block, duplicate protection, opt-out, group delete rules, provider error mapping with a fake `fetch`.

## Open items (need the AwajDigital docs pages)
Direct TTS Broadcast, Upload Voice, Get Broadcast Result and Error Responses: exact fields, limits, costs, Bangla TTS support and the status of each number.
Until confirmed, those parts are implemented behind the adapter in `awajdigital.ts` only, so a mismatch is a one-file change.
Permission name for sending campaigns (reuse `appointments:write` or add a new one) is also open.
