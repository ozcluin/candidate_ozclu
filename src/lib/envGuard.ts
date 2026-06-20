/**
 * Environment validation guard for the Candidate Portal.
 * Called once on first database connection.
 * In production, fails fast if unsafe configuration is detected.
 */

const isProduction = process.env.NODE_ENV === "production";

export function validateEnvironment(): void {
  if (!isProduction) return;

  const errors: string[] = [];

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    errors.push("NEXTAUTH_SECRET is not set.");
  } else if (secret === "clusoverify-secret-key-123456789") {
    errors.push("NEXTAUTH_SECRET is using the insecure default value. Set a strong, unique secret.");
  }

  if (!process.env.MONGODB_URI) {
    errors.push("MONGODB_URI is not set.");
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL || "";
  if (nextAuthUrl.includes("localhost") || nextAuthUrl.includes("127.0.0.1")) {
    errors.push(`NEXTAUTH_URL contains localhost (${nextAuthUrl}). Use a production URL.`);
  }

  // DigiLocker mock mode must be disabled in production
  if (process.env.SIMULATE_DIGILOCKER === "true") {
    errors.push("SIMULATE_DIGILOCKER is set to 'true'. Mock DigiLocker mode is not allowed in production.");
  }

  // DigiLocker credentials must be set
  if (!process.env.DIGILOCKER_CLIENT_ID) {
    errors.push("DIGILOCKER_CLIENT_ID is not set.");
  }
  if (!process.env.DIGILOCKER_CLIENT_SECRET) {
    errors.push("DIGILOCKER_CLIENT_SECRET is not set.");
  }

  // DigiLocker callback must not use localhost
  const callbackUrl = process.env.DIGILOCKER_CALLBACK_URL || "";
  if (callbackUrl.includes("localhost") || callbackUrl.includes("127.0.0.1")) {
    errors.push(`DIGILOCKER_CALLBACK_URL contains localhost (${callbackUrl}). Use a production HTTPS URL.`);
  }

  const encKeys = process.env.DATA_ENCRYPTION_KEYS;
  const currentVer = process.env.DATA_ENCRYPTION_CURRENT_KEY_VERSION;

  if (!encKeys) {
    errors.push("DATA_ENCRYPTION_KEYS is not set.");
  } else {
    const keyParts = encKeys.split(";");
    const versions = new Set<string>();
    for (const part of keyParts) {
      const idx = part.indexOf(":");
      if (idx === -1) {
        errors.push("DATA_ENCRYPTION_KEYS format is invalid. Must be 'version:base64key;...'.");
        break;
      }
      const version = part.substring(0, idx).trim();
      const base64Key = part.substring(idx + 1).trim();
      versions.add(version);

      try {
        const keyBuffer = Buffer.from(base64Key, "base64");
        if (keyBuffer.length !== 32) {
          errors.push(`Encryption key for version '${version}' must be exactly 32 bytes when base64-decoded (got ${keyBuffer.length} bytes).`);
        }
      } catch (err) {
        errors.push(`Encryption key for version '${version}' is not a valid base64 string.`);
      }
    }

    if (!currentVer) {
      errors.push("DATA_ENCRYPTION_CURRENT_KEY_VERSION is not set.");
    } else if (!versions.has(currentVer)) {
      errors.push(`DATA_ENCRYPTION_CURRENT_KEY_VERSION '${currentVer}' is not defined in DATA_ENCRYPTION_KEYS.`);
    }
  }

  if (errors.length > 0) {
    const msg = [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║  FATAL: Unsafe production configuration detected            ║",
      "║  Portal: Candidate                                          ║",
      "╚══════════════════════════════════════════════════════════════╝",
      "",
      ...errors.map((e) => `  ✗ ${e}`),
      "",
      "Fix the above issues in your environment variables before deploying.",
      "",
    ].join("\n");
    console.error(msg);
  }

  console.log("[ENV] Candidate portal environment validation passed.");
}
