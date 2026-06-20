import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { connectToDatabase } from "./mongodb";

// ─── Types ───────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  role: "client" | "admin" | "candidate";
  orgName: string;
  fullName: string;
}

interface AuthResult {
  session: any;
  user: SessionUser;
}

// ─── Guards ──────────────────────────────────────────────────────

/**
 * Require an authenticated session. Returns 401 if not authenticated.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    console.warn("[AUTH] Unauthenticated request to protected candidate API route");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { db } = await connectToDatabase();
  const email = (session.user.email || "").toLowerCase().trim();
  const dbUser = await db.collection("users").findOne({
    email,
    isDeleted: { $ne: true }
  });

  if (!dbUser) {
    console.warn(`[AUTH] Authenticated candidate ${email} not found or is soft-deleted`);
    return NextResponse.json({ error: "Unauthorized: Candidate account has been deactivated or deleted." }, { status: 401 });
  }

  if (dbUser.orgName) {
    const org = await db.collection("organisations").findOne({
      name: dbUser.orgName,
      isDeleted: { $ne: true }
    });
    if (!org) {
      console.warn(`[AUTH] Candidate user ${email}'s organisation "${dbUser.orgName}" is deleted`);
      return NextResponse.json({ error: "Unauthorized: The associated organisation has been deleted." }, { status: 401 });
    }
    if (org.status === "Deactivated") {
      console.warn(`[AUTH] Candidate user ${email}'s organisation "${dbUser.orgName}" is deactivated`);
      return NextResponse.json({ error: "Unauthorized: The associated organisation has been deactivated." }, { status: 401 });
    }
  }

  const user: SessionUser = {
    id: dbUser._id.toString(),
    email: dbUser.email,
    role: dbUser.role,
    orgName: dbUser.orgName || "",
    fullName: dbUser.fullName || "",
  };
  return { session, user };
}

/**
 * Require that the authenticated user has one of the allowed roles.
 * Returns 403 if the role does not match.
 */
export function requireRole(
  user: SessionUser,
  allowedRoles: string[]
): NextResponse | null {
  if (!allowedRoles.includes(user.role)) {
    console.warn(
      `[AUTH] Forbidden: user ${user.email} with role "${user.role}" attempted candidate portal access`
    );
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }
  return null;
}

// ─── Response Sanitization ───────────────────────────────────────

/** Fields to always strip from candidate-facing verification responses */
const CANDIDATE_STRIP_FIELDS = [
  "tempPassword",
  "password",
] as const;

/**
 * Strip sensitive fields from a verification document returned to a candidate.
 */
export function sanitizeVerification(doc: any): any {
  if (!doc) return doc;
  const clean = { ...doc };
  for (const field of CANDIDATE_STRIP_FIELDS) {
    delete clean[field];
  }
  if (clean._id) {
    clean._id = clean._id.toString ? clean._id.toString() : String(clean._id);
  }
  return clean;
}

/**
 * Helper to check if a requireAuth/requireRole result is an error response.
 */
export function isErrorResponse(result: any): result is NextResponse {
  return result instanceof NextResponse;
}
