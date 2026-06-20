/**
 * Shared Encryption Module — AES-256-GCM with versioned keys.
 *
 * Environment variables:
 *   DATA_ENCRYPTION_KEYS       = "v1:BASE64KEY1;v2:BASE64KEY2"
 *   DATA_ENCRYPTION_CURRENT_KEY_VERSION = "v2"
 *
 * Each encrypted value is stored as a JSON-encoded object:
 *   { __enc: true, v: "v2", iv: "base64...", tag: "base64...", ct: "base64..." }
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit recommended for GCM
const TAG_LENGTH = 16;

// ─── Key Management ────────────────────────────────────────────

interface EncryptionKey {
  version: string;
  key: Buffer;
}

let _keys: Map<string, EncryptionKey> | null = null;
let _currentVersion: string | null = null;

function loadKeys(): Map<string, EncryptionKey> {
  if (_keys) return _keys;

  const raw = process.env.DATA_ENCRYPTION_KEYS;
  if (!raw) {
    throw new Error(
      "[ENCRYPTION] DATA_ENCRYPTION_KEYS environment variable is not set."
    );
  }

  _currentVersion =
    process.env.DATA_ENCRYPTION_CURRENT_KEY_VERSION || null;

  const keyMap = new Map<string, EncryptionKey>();
  const entries = raw.split(";").filter(Boolean);

  for (const entry of entries) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) {
      throw new Error(
        `[ENCRYPTION] Invalid key format. Expected "version:base64key", got: "${entry.substring(0, 10)}..."`
      );
    }
    const version = entry.substring(0, colonIdx).trim();
    const b64 = entry.substring(colonIdx + 1).trim();
    const keyBuf = Buffer.from(b64, "base64");

    if (keyBuf.length !== 32) {
      throw new Error(
        `[ENCRYPTION] Key "${version}" must be exactly 32 bytes (256 bits). Got ${keyBuf.length} bytes.`
      );
    }

    keyMap.set(version, { version, key: keyBuf });
  }

  if (!_currentVersion || !keyMap.has(_currentVersion)) {
    // Default to the last key in the list
    const lastKey = entries[entries.length - 1];
    _currentVersion = lastKey.substring(0, lastKey.indexOf(":")).trim();
  }

  _keys = keyMap;
  return keyMap;
}

function getCurrentKey(): EncryptionKey {
  const keys = loadKeys();
  const key = keys.get(_currentVersion!);
  if (!key) {
    throw new Error(
      `[ENCRYPTION] Current key version "${_currentVersion}" not found in DATA_ENCRYPTION_KEYS.`
    );
  }
  return key;
}

function getKeyByVersion(version: string): EncryptionKey {
  const keys = loadKeys();
  const key = keys.get(version);
  if (!key) {
    throw new Error(
      `[ENCRYPTION] Key version "${version}" not found. Available: ${Array.from(keys.keys()).join(", ")}`
    );
  }
  return key;
}

// ─── Encrypted Value Shape ─────────────────────────────────────

export interface EncryptedValue {
  __enc: true;
  v: string; // key version
  iv: string; // base64
  tag: string; // base64
  ct: string; // base64 ciphertext
}

export function isEncryptedValue(value: any): value is EncryptedValue {
  return (
    value !== null &&
    typeof value === "object" &&
    value.__enc === true &&
    typeof value.v === "string" &&
    typeof value.iv === "string" &&
    typeof value.ct === "string"
  );
}

// ─── Encrypt / Decrypt ─────────────────────────────────────────

/**
 * Encrypt a plaintext string. Returns an EncryptedValue object.
 */
export function encrypt(plaintext: string): EncryptedValue {
  if (!plaintext) {
    throw new Error("[ENCRYPTION] Cannot encrypt empty/null value.");
  }

  const { version, key } = getCurrentKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    __enc: true,
    v: version,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: encrypted.toString("base64"),
  };
}

/**
 * Decrypt an EncryptedValue object back to plaintext.
 */
export function decrypt(encrypted: EncryptedValue): string {
  if (!isEncryptedValue(encrypted)) {
    throw new Error("[ENCRYPTION] Invalid encrypted value format.");
  }

  const { key } = getKeyByVersion(encrypted.v);
  const iv = Buffer.from(encrypted.iv, "base64");
  const tag = Buffer.from(encrypted.tag, "base64");
  const ciphertext = Buffer.from(encrypted.ct, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ─── Migration Helpers ─────────────────────────────────────────

/**
 * Encrypt a value only if it's currently plaintext (string).
 * If already encrypted, return as-is.
 * If null/undefined/empty, return as-is.
 */
export function encryptIfPlaintext(
  value: string | EncryptedValue | null | undefined
): EncryptedValue | null {
  if (value === null || value === undefined || value === "") return null;
  if (isEncryptedValue(value)) return value;
  if (typeof value === "string") return encrypt(value);
  return null;
}

/**
 * Decrypt a value whether it's encrypted or already plaintext.
 * If null/undefined, return empty string.
 */
export function decryptOrPassthrough(
  value: string | EncryptedValue | null | undefined
): string {
  if (value === null || value === undefined) return "";
  if (isEncryptedValue(value)) return decrypt(value);
  if (typeof value === "string") return value; // legacy plaintext
  return "";
}

/**
 * Generate a masked version of sensitive fields for display.
 */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return "xxxx";
  // Already masked pattern like "xxxxxxxx9617"
  if (aadhaar.startsWith("x")) return aadhaar;
  const last4 = aadhaar.slice(-4);
  return `xxxxxxxx${last4}`;
}

export function maskPan(pan: string): string {
  if (!pan || pan.length < 4) return "XXXXXXXXXX";
  return `XXXXXX${pan.slice(-4)}`;
}

export function maskDl(dl: string): string {
  if (!dl || dl.length < 4) return "XXXXXXX";
  return `${"X".repeat(dl.length - 4)}${dl.slice(-4)}`;
}

/**
 * Generate a deterministic HMAC for equality lookup without decryption.
 * Uses a separate HMAC key derived from the current encryption key.
 */
export function hmacForLookup(plaintext: string): string {
  const { key } = getCurrentKey();
  return crypto
    .createHmac("sha256", key)
    .update(plaintext.toLowerCase().trim())
    .digest("hex");
}
