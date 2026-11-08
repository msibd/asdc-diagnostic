import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Authenticated encryption (AES-256-GCM) for secrets kept in the database, such as the SMTP password.
//
// The key lives only in the environment (EMAIL_ENCRYPTION_KEY: 32 random bytes as base64 or 64 hex
// characters), never in the database, so a database dump alone reveals nothing. Each value gets a
// fresh random IV, and GCM's tag makes any tampering fail loudly on decryption.
//
// Key rotation: put the new key in EMAIL_ENCRYPTION_KEY and the old one in EMAIL_ENCRYPTION_KEY_PREVIOUS.
// Stored values name the key that made them ("keyId"), so old values still open, and they are
// re-encrypted with the new key the next time the settings are saved.
//
// Stored format: v1.<keyId>.<iv>.<tag>.<ciphertext>   (each part base64url)

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

function parseKey(raw: string | undefined, name: string): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) throw new SecretBoxError(`${name} must be 32 bytes (64 hex characters or 44 base64 characters).`);
  return key;
}

/** First 8 hex characters of a hash of the key: names the key without revealing it. */
const keyIdOf = (key: Buffer) => createHash("sha256").update(key).digest("hex").slice(0, 8);

function keys() {
  const current = parseKey(process.env.EMAIL_ENCRYPTION_KEY, "EMAIL_ENCRYPTION_KEY");
  if (!current) throw new SecretBoxError("EMAIL_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"");
  const previous = parseKey(process.env.EMAIL_ENCRYPTION_KEY_PREVIOUS, "EMAIL_ENCRYPTION_KEY_PREVIOUS");
  return { current, previous };
}

export function isEncryptionConfigured() {
  try {
    keys();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string) {
  const { current } = keys();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", current, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", keyIdOf(current), iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(stored: string) {
  const [version, keyId, iv, tag, ciphertext] = stored.split(".");
  if (version !== "v1" || !keyId || !iv || !tag || !ciphertext) throw new SecretBoxError("The stored secret is not in a known format.");
  const { current, previous } = keys();
  const key = [current, previous].find((candidate) => candidate && keyIdOf(candidate) === keyId);
  if (!key) throw new SecretBoxError("The stored secret was encrypted with a key that is no longer configured.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or altered data. Never include the stored value in the message.
    throw new SecretBoxError("The stored secret could not be decrypted (wrong key or altered data).");
  }
}

/** True when a stored value was made with a key other than the current one (re-encrypt on next save). */
export function needsReencryption(stored: string) {
  const { current } = keys();
  return stored.split(".")[1] !== keyIdOf(current);
}
