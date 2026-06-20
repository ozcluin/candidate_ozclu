import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "src/lib/mongodb";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";

/**
 * Hash a setup token for storage comparison.
 * Tokens are stored hashed (SHA-256) — never plaintext.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Validate password strength.
 * Requires: min 8 chars, 1 uppercase, 1 lowercase, 1 number.
 */
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  return null;
}

/**
 * GET: Validate a setup token.
 * Query params: ?token={token}&email={email}
 * Returns: { valid: true } or { valid: false, reason: string }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email")?.toLowerCase().trim();

    if (!token || !email) {
      return NextResponse.json({ valid: false, reason: "Missing token or email." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const tokenHash = hashToken(token);

    const record = await db.collection("setupTokens").findOne({
      email,
      tokenHash,
      used: false,
    });

    if (!record) {
      return NextResponse.json({ valid: false, reason: "Invalid or expired setup link." });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return NextResponse.json({ valid: false, reason: "This setup link has expired. Please contact your organisation to request a new one." });
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error("[AUTH] Setup token validation error:", error.message);
    return NextResponse.json({ valid: false, reason: "Validation failed." }, { status: 500 });
  }
}

/**
 * POST: Set password using a valid setup token.
 * Body: { token, email, password }
 * - Validates token
 * - Validates password strength
 * - Sets password on user record
 * - Marks token as used (deletes it)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email: rawEmail, password } = body;

    if (!token || !rawEmail || !password) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const email = rawEmail.toLowerCase().trim();

    // Validate password strength
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const tokenHash = hashToken(token);

    // Find and validate token
    const record = await db.collection("setupTokens").findOne({
      email,
      tokenHash,
      used: false,
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid or already used setup link." }, { status: 400 });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return NextResponse.json({ error: "This setup link has expired. Please contact your organisation to request a new one." }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Update user record
    const updateResult = await db.collection("users").updateOne(
      { email },
      { $set: { password: hashedPassword, passwordSetAt: new Date() } }
    );

    if (updateResult.matchedCount === 0) {
      console.error(`[AUTH] Setup password: no user found for email ${email}`);
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    // Delete the token (one-time use)
    await db.collection("setupTokens").deleteOne({ _id: record._id });

    // Clean up any other expired tokens for this email
    await db.collection("setupTokens").deleteMany({
      email,
      expiresAt: { $lt: new Date() },
    });

    console.log(`[AUTH] Password set successfully for candidate: ${email}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[AUTH] Setup password error:", error.message);
    return NextResponse.json({ error: "Failed to set password." }, { status: 500 });
  }
}
